package com.finsight;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.*;
import com.finsight.auth.AuthController;
import com.finsight.chat.*;
import com.finsight.chat.ChatRequests.*;
import com.finsight.model.Entities.Category;
import com.finsight.model.Entities.User;
import com.finsight.model.Entities.Wallet;
import com.finsight.transaction.FinanceRequests.*;
import com.finsight.transaction.FinanceService;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@SpringBootTest
@AutoConfigureMockMvc
class ChatIntegrationTest {
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired AuthController auth;
  @Autowired FinanceService finance;
  @Autowired ChatStore store;
  @Autowired JdbcTemplate sql;
  @MockitoBean ChatClient ai;
  User owner;
  User other;
  long conversation;

  @BeforeEach
  void setup() throws Exception {
    owner = register("Owner");
    other = register("Other");
    when(ai.status())
        .thenReturn(
            Map.of(
                "configured",
                true,
                "provider",
                "test-local",
                "model",
                "test:model",
                "external",
                false));
    when(ai.generate(any())).thenReturn(response());
    conversation = create(owner, "Kế hoạch của tôi");
  }

  User register(String name) {
    return auth.register(
        new AuthController.Registration(
            UUID.randomUUID() + "@chat.test", "SecurePassword123!", name));
  }

  long create(User user, String title) throws Exception {
    var result =
        mvc.perform(
                post("/api/chat/conversations")
                    .with(user(user.email))
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(Map.of("title", title))))
            .andExpect(status().isCreated())
            .andReturn();
    return json.readTree(result.getResponse().getContentAsString()).get("id").asLong();
  }

  Map<String, Object> response() {
    return Map.of(
        "content",
        "Bạn có thể xem lại các danh mục chi tiêu và đặt ngân sách phù hợp.",
        "modelVersion",
        "test:model",
        "provider",
        "test-local",
        "metadata",
        Map.of(
            "grounding",
            "verified-fact-placeholders",
            "fineTuned",
            false,
            "mlStatus",
            Map.of("forecast", "INSUFFICIENT_DATA")));
  }

  @Test
  void persistsFineTunedReferenceMetadataInHistory() throws Exception {
    when(ai.generate(any())).thenReturn(
        Map.of("content", "Random Forest kết hợp nhiều cây quyết định.",
            "modelVersion", "finsight-qlora", "provider", "mlx",
            "metadata", Map.of("fineTuned", true, "responseMode", "llm",
                "followUpResolved", true, "knowledgeTopics", List.of("Random Forest"))));
    var answer = send(owner, conversation, UUID.randomUUID().toString(), "Giải thích Random Forest");
    assertTrue(answer.get("metadata").get("fineTuned").asBoolean());
    assertEquals("llm", answer.get("metadata").get("responseMode").asText());
    var saved = messages(owner, conversation).get("items").get(1).get("metadata");
    assertTrue(saved.get("followUpResolved").asBoolean());
    assertEquals("Random Forest", saved.get("knowledgeTopics").get(0).asText());
  }

  JsonNode send(User user, long id, String key, String text) throws Exception {
    var result =
        mvc.perform(
                post("/api/chat/conversations/" + id + "/messages")
                    .with(user(user.email))
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        json.writeValueAsString(Map.of("content", text, "clientMessageId", key))))
            .andExpect(status().isOk())
            .andReturn();
    return json.readTree(result.getResponse().getContentAsString());
  }

  JsonNode messages(User user, long id) throws Exception {
    var result =
        mvc.perform(get("/api/chat/conversations/" + id + "/messages").with(user(user.email)))
            .andExpect(status().isOk())
            .andReturn();
    return json.readTree(result.getResponse().getContentAsString());
  }

  long count(String table, long user) {
    return sql.queryForObject(
        "SELECT COUNT(*) FROM " + table + " WHERE user_id=?", Long.class, user);
  }

  @Test
  void allChatRoutesRequireSessionAndMutationsRequireCsrf() throws Exception {
    mvc.perform(get("/api/chat/status")).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/chat/conversations")).andExpect(status().isUnauthorized());
    mvc.perform(
            post("/api/chat/conversations")
                .with(user(owner.email))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(status().isForbidden());
    mvc.perform(
            put("/api/chat/preferences")
                .with(user(owner.email))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"externalConsent\":true}"))
        .andExpect(status().isForbidden());
  }

  @Test
  void anotherAccountCannotReadModifyDeleteSendCancelOrRateMessages() throws Exception {
    var answer = send(owner, conversation, "owned", "Tư vấn tiết kiệm");
    var base = "/api/chat/conversations/" + conversation;
    mvc.perform(get(base + "/messages").with(user(other.email))).andExpect(status().isNotFound());
    mvc.perform(
            patch(base)
                .with(user(other.email))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Stolen\"}"))
        .andExpect(status().isNotFound());
    mvc.perform(delete(base).with(user(other.email)).with(csrf())).andExpect(status().isNotFound());
    mvc.perform(
            post(base + "/messages")
                .with(user(other.email))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Đọc số dư\",\"clientMessageId\":\"foreign\"}"))
        .andExpect(status().isNotFound());
    mvc.perform(
            post(base + "/cancel")
                .with(user(other.email))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"clientMessageId\":\"owned\"}"))
        .andExpect(status().isNotFound());
    mvc.perform(
            post("/api/chat/messages/" + answer.get("id").asLong() + "/feedback")
                .with(user(other.email))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"rating\":1}"))
        .andExpect(status().isNotFound());
    var result =
        mvc.perform(get("/api/chat/conversations").with(user(other.email)))
            .andExpect(status().isOk())
            .andReturn();
    assertEquals(0, json.readTree(result.getResponse().getContentAsString()).get("total").asInt());
    verify(ai, times(1)).generate(any());
    assertEquals(2, count("chat_messages", owner.id));
  }

  @Test
  void replaySameRequestReturnsSameAnswerAndChangedPayloadConflicts() throws Exception {
    var first = send(owner, conversation, "replay", "Chi tiêu tháng này");
    var second = send(owner, conversation, "replay", "Chi tiêu tháng này");
    assertEquals(first.get("id"), second.get("id"));
    assertEquals("COMPLETED", second.get("status").asText());
    assertFalse(second.get("metadata").get("fineTuned").asBoolean());
    assertEquals(
        "INSUFFICIENT_DATA", second.get("metadata").get("mlStatus").get("forecast").asText());
    assertEquals(2, messages(owner, conversation).get("total").asInt());
    mvc.perform(
            post("/api/chat/conversations/" + conversation + "/messages")
                .with(user(owner.email))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Nội dung khác\",\"clientMessageId\":\"replay\"}"))
        .andExpect(status().isConflict());
    verify(ai, times(1)).generate(any());
  }

  @Test
  void concurrentDuplicateDoesNotGenerateAgainAndCancelRejectsLateAnswer() throws Exception {
    var entered = new CountDownLatch(1);
    var release = new CountDownLatch(1);
    doAnswer(
            call -> {
              assertFalse(TransactionSynchronizationManager.isActualTransactionActive());
              entered.countDown();
              assertTrue(release.await(10, TimeUnit.SECONDS));
              return response();
            })
        .when(ai)
        .generate(any());
    var executor = Executors.newSingleThreadExecutor();
    try {
      var first = executor.submit(() -> send(owner, conversation, "pending", "Tư vấn ngân sách"));
      assertTrue(entered.await(10, TimeUnit.SECONDS));
      var duplicate = send(owner, conversation, "pending", "Tư vấn ngân sách");
      assertEquals("PENDING", duplicate.get("status").asText());
      var cancel =
          mvc.perform(
                  post("/api/chat/conversations/" + conversation + "/cancel")
                      .with(user(owner.email))
                      .with(csrf())
                      .contentType(MediaType.APPLICATION_JSON)
                      .content("{\"clientMessageId\":\"pending\"}"))
              .andExpect(status().isOk())
              .andReturn();
      assertEquals(
          "CANCELLED",
          json.readTree(cancel.getResponse().getContentAsString()).get("status").asText());
      release.countDown();
      assertEquals("CANCELLED", first.get(10, TimeUnit.SECONDS).get("status").asText());
      var history = messages(owner, conversation);
      assertEquals(2, history.get("total").asInt());
      assertEquals("CANCELLED", history.get("items").get(1).get("status").asText());
      assertFalse(history.toString().contains(response().get("content").toString()));
      verify(ai, times(1)).generate(any());
      verify(ai, times(1)).cancel(anyString());
    } finally {
      release.countDown();
      executor.shutdownNow();
    }
  }

  @Test
  void failurePersistsHonestStatusAndRetryResumesSamePairWithoutMoneyWrites() throws Exception {
    var wallet =
        finance.createWallet(owner.id, new WalletInput("Cash", "CASH", new BigDecimal("1000.00")));
    when(ai.generate(any()))
        .thenThrow(new ChatClient.ChatUnavailableException())
        .thenReturn(response());
    mvc.perform(
            post("/api/chat/conversations/" + conversation + "/messages")
                .with(user(owner.email))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Số dư của tôi\",\"clientMessageId\":\"retry\"}"))
        .andExpect(status().isServiceUnavailable());
    var failed = messages(owner, conversation).get("items").get(1);
    assertEquals("FAILED", failed.get("status").asText());
    var recovered = send(owner, conversation, "retry", "Số dư của tôi");
    assertEquals(failed.get("id"), recovered.get("id"));
    assertEquals("COMPLETED", recovered.get("status").asText());
    assertEquals(2, count("chat_messages", owner.id));
    assertEquals(0, count("transactions", owner.id));
    assertEquals(
        0,
        finance
            .owned(Wallet.class, wallet.id, owner.id)
            .balance
            .compareTo(new BigDecimal("1000.00")));
  }

  @Test
  @SuppressWarnings("unchecked")
  void financialContextIsOwnedExactAndIoRunsOutsideTransaction() throws Exception {
    var wallet =
        finance.createWallet(owner.id, new WalletInput("Owned", "CASH", new BigDecimal("1000.00")));
    var category = finance.list(Category.class, owner.id).getFirst();
    finance.addTransaction(
        owner.id,
        new TransactionInput(
            wallet.id,
            category.id,
            "EXPENSE",
            new BigDecimal("12.34"),
            "Never send private description",
            LocalDateTime.now().minusHours(1)),
        "context-expense");
    finance.budget(
        owner.id,
        null,
        new BudgetInput(category.id, YearMonth.now().toString(), new BigDecimal("50.00")));
    finance.createWallet(
        other.id, new WalletInput("Secret-other-name", "CASH", new BigDecimal("999999.99")));
    var captured = new AtomicReference<Map<String, Object>>();
    doAnswer(
            call -> {
              assertFalse(TransactionSynchronizationManager.isActualTransactionActive());
              captured.set((Map<String, Object>) call.getArgument(0));
              return response();
            })
        .when(ai)
        .generate(any());
    send(owner, conversation, "context", "Tôi còn bao nhiêu ngân sách?");
    var context = (Map<String, Object>) captured.get().get("context");
    var facts = (List<Map<String, Object>>) context.get("facts");
    var byId = new HashMap<String, Map<String, Object>>();
    facts.forEach(f -> byId.put(f.get("id").toString(), f));
    assertEquals("12.34", byId.get("expense").get("value"));
    assertEquals("987.66", byId.get("balance").get("value"));
    assertEquals("37.66", byId.get("budgetRemaining").get("value"));
    assertEquals("money", byId.get("expense").get("kind"));
    assertEquals("ACTUAL", byId.get("expense").get("nature"));
    assertEquals(YearMonth.now().toString(), context.get("month"));
    assertNotNull(context.get("asOf"));
    assertNotNull(context.get("sources"));
    var payload = json.writeValueAsString(captured.get());
    assertFalse(payload.contains("Secret-other-name"));
    assertFalse(payload.contains("999999.99"));
    assertFalse(payload.contains("Never send private description"));
    assertFalse(payload.contains(owner.email));
    assertFalse(payload.contains(owner.passwordHash));
    assertFalse(payload.contains("password"));
  }

  @Test
  void invalidPeriodRollsBackPreparationAndPaginationRejectsUnboundedReads() throws Exception {
    mvc.perform(
            post("/api/chat/conversations/" + conversation + "/messages")
                .with(user(owner.email))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"content\":\"Tư"
                        + " vấn\",\"clientMessageId\":\"bad-month\",\"month\":\"2026-13\"}"))
        .andExpect(status().isBadRequest());
    assertEquals(0, count("chat_messages", owner.id));
    verify(ai, never()).generate(any());
    mvc.perform(
            get("/api/chat/conversations/" + conversation + "/messages?size=101")
                .with(user(owner.email)))
        .andExpect(status().isBadRequest());
    mvc.perform(get("/api/chat/conversations?page=-1").with(user(owner.email)))
        .andExpect(status().isBadRequest());
  }

  @Test
  void externalProviderRequiresOptInAndRevocationCancelsPendingOutput() throws Exception {
    when(ai.status())
        .thenReturn(
            Map.of(
                "configured",
                true,
                "provider",
                "external-test",
                "model",
                "test:model",
                "external",
                true));
    mvc.perform(
            post("/api/chat/conversations/" + conversation + "/messages")
                .with(user(owner.email))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Tư vấn\",\"clientMessageId\":\"privacy\"}"))
        .andExpect(status().isForbidden());
    assertEquals(0, count("chat_messages", owner.id));
    verify(ai, never()).generate(any());
    store.preference(owner.id, new Preference(true));
    var prepared = store.prepare(owner.id, conversation, new Send("Tư vấn", "privacy", null), true);
    assertEquals(true, prepared.payload().get("externalConsent"));
    store.preference(owner.id, new Preference(false));
    var late = store.finish(prepared, response(), false);
    assertEquals("CANCELLED", late.get("status"));
    assertFalse(late.get("content").equals(response().get("content")));
    mvc.perform(get("/api/chat/preferences").with(user(other.email)))
        .andExpect(jsonPath("$.externalConsent").value(false));
  }

  @Test
  void boundedPendingRequestsAndCrashedGenerationCanRetryWithoutDuplication() {
    var first = store.prepare(owner.id, conversation, new Send("One", "one", null), false);
    store.prepare(owner.id, conversation, new Send("Two", "two", null), false);
    var failure =
        assertThrows(
            org.springframework.web.server.ResponseStatusException.class,
            () -> store.prepare(owner.id, conversation, new Send("Three", "three", null), false));
    assertEquals(429, failure.getStatusCode().value());
    assertEquals(4, count("chat_messages", owner.id));
    sql.update(
        "UPDATE chat_messages SET updated_at=? WHERE id=?",
        java.sql.Timestamp.valueOf(LocalDateTime.now().minusMinutes(3)),
        first.assistantId());
    var retry = store.prepare(owner.id, conversation, new Send("One", "one", null), false);
    assertTrue(retry.generate());
    assertEquals(first.assistantId(), retry.assistantId());
    assertNotEquals(first.attemptToken(), retry.attemptToken());
    var staleFinish = store.finish(first, response(), false);
    assertEquals("PENDING", staleFinish.get("status"));
    assertEquals("COMPLETED", store.finish(retry, response(), false).get("status"));
  }

  @Test
  @SuppressWarnings("unchecked")
  void reloadHistoryIsChronologicalAndOnlyCompletedOwnedPairsBecomeContext() throws Exception {
    var first = send(owner, conversation, "history-one", "Tháng này chi vào đâu?");
    var captured = new AtomicReference<Map<String, Object>>();
    doAnswer(
            call -> {
              captured.set((Map<String, Object>) call.getArgument(0));
              return response();
            })
        .when(ai)
        .generate(any());
    send(owner, conversation, "history-two", "Tiếp tục tư vấn");
    var previous = (List<Map<String, String>>) captured.get().get("history");
    assertEquals(2, previous.size());
    assertEquals("user", previous.getFirst().get("role"));
    assertEquals("assistant", previous.getLast().get("role"));
    assertEquals("Tháng này chi vào đâu?", previous.getFirst().get("content"));
    var all = messages(owner, conversation);
    assertEquals(4, all.get("total").asInt());
    assertEquals(first.get("id"), all.get("items").get(1).get("id"));
    mvc.perform(
            get("/api/chat/conversations/" + conversation + "/messages?page=1&size=2")
                .with(user(owner.email)))
        .andExpect(jsonPath("$.items[0].content").value("Tiếp tục tư vấn"))
        .andExpect(jsonPath("$.total").value(4));
  }

  @Test
  void renameSearchFeedbackDeleteCascadeAndAccountRemovalWork() throws Exception {
    var answer = send(owner, conversation, "remove", "Tư vấn");
    mvc.perform(
            patch("/api/chat/conversations/" + conversation)
                .with(user(owner.email))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Kế hoạch 100%_riêng\"}"))
        .andExpect(status().isOk());
    mvc.perform(get("/api/chat/conversations").param("search", "%_").with(user(owner.email)))
        .andExpect(jsonPath("$.total").value(1));
    var feedbackPath = "/api/chat/messages/" + answer.get("id").asLong() + "/feedback";
    mvc.perform(
            post(feedbackPath)
                .with(user(owner.email))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"rating\":1,\"comment\":\"Hữu ích\"}"))
        .andExpect(jsonPath("$.trainingUse").value(false));
    mvc.perform(
            post(feedbackPath)
                .with(user(owner.email))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"rating\":-1}"))
        .andExpect(status().isOk());
    assertEquals(1, count("chat_feedback", owner.id));
    mvc.perform(
            get("/api/chat/conversations/" + conversation + "/messages").with(user(owner.email)))
        .andExpect(jsonPath("$.items[1].feedbackRating").value(-1));
    mvc.perform(
            delete("/api/chat/conversations/" + conversation).with(user(owner.email)).with(csrf()))
        .andExpect(status().isNoContent());
    assertEquals(0, count("chat_messages", owner.id));
    assertEquals(0, count("chat_feedback", owner.id));
    var remaining = create(owner, "Delete with account");
    var newAnswer = send(owner, remaining, "account", "Tư vấn tài chính");
    store.feedback(owner.id, newAnswer.get("id").asLong(), new Feedback(1, "Account feedback"));
    store.preference(owner.id, new Preference(true));
    auth.delete(
        new UsernamePasswordAuthenticationToken(owner.email, "unused"),
        new AuthController.Login(owner.email, "SecurePassword123!"));
    for (var table :
        List.of("chat_conversations", "chat_messages", "chat_feedback", "chat_preferences"))
      assertEquals(0, count(table, owner.id));
    assertEquals(
        0, sql.queryForObject("SELECT COUNT(*) FROM users WHERE id=?", Long.class, owner.id));
  }
}
