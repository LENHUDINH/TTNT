package com.finsight.chat;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.finsight.chat.ChatEntities.*;
import com.finsight.chat.ChatRequests.*;
import com.finsight.transaction.FinanceService;
import jakarta.persistence.EntityManager;
import java.time.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/** Database work is deliberately separate from the ChatClient's remote calls. */
@Service
@Transactional(isolation = Isolation.READ_COMMITTED)
public class ChatStore {
  private final EntityManager em;
  private final FinanceService finance;
  private final ChatContext context;
  private final ObjectMapper json;

  private record Bucket(long window, AtomicInteger count) {}

  private final ConcurrentHashMap<Long, Bucket> buckets = new ConcurrentHashMap<>();

  public record Prepared(
      long userId,
      long conversationId,
      long assistantId,
      String attemptToken,
      Map<String, Object> payload,
      Map<String, Object> message,
      boolean generate) {}

  public record Cancelled(Map<String, Object> message, String requestId) {}

  public ChatStore(
      EntityManager em, FinanceService finance, ChatContext context, ObjectMapper json) {
    this.em = em;
    this.finance = finance;
    this.context = context;
    this.json = json;
  }

  private String serialize(Object value) {
    try {
      return json.writeValueAsString(value);
    } catch (Exception e) {
      throw new IllegalStateException("Cannot serialize chat metadata");
    }
  }

  private Map<String, Object> metadata(String value) {
    try {
      return json.readValue(value, new TypeReference<Map<String, Object>>() {});
    } catch (Exception ignored) {
      return new LinkedHashMap<>();
    }
  }

  public Map<String, Object> messageView(ChatMessage m) {
    var result = new LinkedHashMap<String, Object>();
    result.put("id", m.id);
    result.put("conversationId", m.conversationId);
    result.put("role", m.role);
    result.put("content", m.content);
    result.put("status", m.status);
    result.put("clientMessageId", m.clientMessageId);
    result.put("modelVersion", m.modelVersion);
    result.put("createdAt", m.createdAt);
    result.put("metadata", metadata(m.metadata));
    return result;
  }

  public Map<String, Object> conversationView(ChatConversation c) {
    return Map.of("id", c.id, "title", c.title, "createdAt", c.createdAt, "updatedAt", c.updatedAt);
  }

  private void page(int page, int size) {
    if (page < 0 || page > 100000 || size < 1 || size > 100)
      throw FinanceService.bad("Phân trang không hợp lệ");
  }

  private List<ChatMessage> pair(long user, long conversation, String clientId, String role) {
    return em.createQuery(
            "from ChatMessage where userId=:u and conversationId=:c and clientMessageId=:k and"
                + " role=:r",
            ChatMessage.class)
        .setParameter("u", user)
        .setParameter("c", conversation)
        .setParameter("k", clientId)
        .setParameter("r", role)
        .getResultList();
  }

  @Transactional(readOnly = true)
  public boolean consent(long user) {
    var rows =
        em.createQuery("from ChatPreference where userId=:u", ChatPreference.class)
            .setParameter("u", user)
            .getResultList();
    return !rows.isEmpty() && rows.getFirst().externalConsent;
  }

  public Object preference(long user, Preference p) {
    finance.lockUser(user);
    var rows =
        em.createQuery("from ChatPreference where userId=:u", ChatPreference.class)
            .setParameter("u", user)
            .getResultList();
    var preference = rows.isEmpty() ? new ChatPreference() : rows.getFirst();
    preference.userId = user;
    preference.externalConsent = p.externalConsent();
    if (rows.isEmpty()) em.persist(preference);
    if (!preference.externalConsent) {
      for (var message :
          em.createQuery(
                  "from ChatMessage where userId=:u and role='ASSISTANT' and status='PENDING'",
                  ChatMessage.class)
              .setParameter("u", user)
              .getResultList()) {
        if (Boolean.TRUE.equals(metadata(message.metadata).get("external"))) {
          message.status = "CANCELLED";
          message.attemptToken = null;
          message.content = "Đã dừng do thay đổi quyền riêng tư.";
          message.updatedAt = LocalDateTime.now();
        }
      }
    }
    finance.audit(
        user,
        p.externalConsent() ? "CHAT_EXTERNAL_CONSENT" : "CHAT_EXTERNAL_REVOKE",
        "chat_preference",
        preference.id);
    return Map.of("externalConsent", preference.externalConsent);
  }

  public Object create(long user, Create p) {
    finance.lockUser(user);
    var c = new ChatConversation();
    c.userId = user;
    c.title = p.title() == null || p.title().isBlank() ? "Cuộc trò chuyện mới" : p.title().trim();
    em.persist(c);
    em.flush();
    return conversationView(c);
  }

  @Transactional(readOnly = true)
  public Object conversations(long user, String search, int page, int size) {
    page(page, size);
    if (search != null && search.length() > 100)
      throw FinanceService.bad("Tìm kiếm tối đa một trăm ký tự");
    var query = "from ChatConversation c where c.userId=:u";
    boolean filtered = search != null && !search.isBlank();
    if (filtered) query += " and lower(c.title) like :search escape '!'";
    var data =
        em.createQuery(query + " order by c.updatedAt desc,c.id desc", ChatConversation.class)
            .setParameter("u", user);
    var count = em.createQuery("select count(c) " + query, Long.class).setParameter("u", user);
    if (filtered) {
      var term =
          "%"
              + search
                  .toLowerCase(Locale.ROOT)
                  .replace("!", "!!")
                  .replace("%", "!%")
                  .replace("_", "!_")
              + "%";
      data.setParameter("search", term);
      count.setParameter("search", term);
    }
    return Map.of(
        "items",
        data.setFirstResult(page * size).setMaxResults(size).getResultList().stream()
            .map(this::conversationView)
            .toList(),
        "total",
        count.getSingleResult(),
        "page",
        page,
        "size",
        size);
  }

  public Object rename(long user, long conversation, Rename p) {
    finance.lockUser(user);
    var c = finance.owned(ChatConversation.class, conversation, user);
    c.title = p.title().trim();
    c.updatedAt = LocalDateTime.now();
    return conversationView(c);
  }

  public void delete(long user, long conversation) {
    finance.lockUser(user);
    em.remove(finance.owned(ChatConversation.class, conversation, user));
    // Composite foreign keys cascade both messages and feedback, with the same owner enforced.
  }

  private void expire(long user) {
    em.createQuery(
            "update ChatMessage set"
                + " status='FAILED',attemptToken=null,content=:message,updatedAt=:now where"
                + " userId=:u and role='ASSISTANT' and status='PENDING' and updatedAt<:cutoff")
        .setParameter("message", "Phản hồi đã quá thời gian chờ. Bạn có thể thử lại.")
        .setParameter("now", LocalDateTime.now())
        .setParameter("cutoff", LocalDateTime.now().minusSeconds(120))
        .setParameter("u", user)
        .executeUpdate();
  }

  public Object messages(long user, long conversation, int page, int size) {
    page(page, size);
    finance.lockUser(user);
    finance.owned(ChatConversation.class, conversation, user);
    expire(user);
    var data =
        em.createQuery(
                "from ChatMessage where userId=:u and conversationId=:c order by id",
                ChatMessage.class)
            .setParameter("u", user)
            .setParameter("c", conversation)
            .setFirstResult(page * size)
            .setMaxResults(size)
            .getResultList();
    var total =
        em.createQuery(
                "select count(m) from ChatMessage m where m.userId=:u and m.conversationId=:c",
                Long.class)
            .setParameter("u", user)
            .setParameter("c", conversation)
            .getSingleResult();
    var ratings = new HashMap<Long, Integer>();
    if (!data.isEmpty()) {
      em.createQuery("from ChatFeedback where userId=:u and messageId in :ids", ChatFeedback.class)
          .setParameter("u", user)
          .setParameter("ids", data.stream().map(m -> m.id).toList())
          .getResultList()
          .forEach(feedback -> ratings.put(feedback.messageId, feedback.rating));
    }
    var items =
        data.stream()
            .map(
                message -> {
                  var view = messageView(message);
                  if (ratings.containsKey(message.id))
                    view.put("feedbackRating", ratings.get(message.id));
                  return view;
                })
            .toList();
    return Map.of("items", items, "total", total, "page", page, "size", size);
  }

  private void limit(long user) {
    long window = System.currentTimeMillis() / 600000;
    if (buckets.size() >= 10000) buckets.entrySet().removeIf(e -> e.getValue().window() < window);
    if (buckets.size() >= 10000 && !buckets.containsKey(user))
      throw new ResponseStatusException(
          HttpStatus.TOO_MANY_REQUESTS, "Chat đang bận. Vui lòng thử lại sau.");
    var bucket =
        buckets.compute(
            user,
            (k, v) ->
                v == null || v.window() != window ? new Bucket(window, new AtomicInteger()) : v);
    if (bucket.count().incrementAndGet() > 20)
      throw new ResponseStatusException(
          HttpStatus.TOO_MANY_REQUESTS, "Bạn đã gửi nhiều câu hỏi. Vui lòng thử lại sau vài phút.");
    var active =
        em.createQuery(
                "select count(m) from ChatMessage m where m.userId=:u and m.role='ASSISTANT' and"
                    + " m.status='PENDING'",
                Long.class)
            .setParameter("u", user)
            .getSingleResult();
    if (active >= 2)
      throw new ResponseStatusException(
          HttpStatus.TOO_MANY_REQUESTS,
          "Đợi phản hồi đang xử lý hoặc dừng trước khi gửi câu hỏi mới.");
  }

  public Prepared prepare(long user, long conversation, Send input, boolean external) {
    finance.lockUser(user);
    var c = finance.owned(ChatConversation.class, conversation, user);
    expire(user);
    var consent = consent(user);
    var existing = pair(user, conversation, input.clientMessageId(), "USER");
    var month = input.month() == null ? YearMonth.now() : YearMonth.parse(input.month());
    if (month.isAfter(YearMonth.now()) || month.getYear() < 1900)
      throw FinanceService.bad("Chọn kỳ đã bắt đầu, không dùng giao dịch tương lai");
    ChatMessage human;
    ChatMessage assistant;
    if (!existing.isEmpty()) {
      human = existing.getFirst();
      var savedMonth = metadata(human.metadata).get("month");
      if (input.month() == null && savedMonth instanceof String saved)
        month = YearMonth.parse(saved);
      if (!human.content.equals(input.content().trim()) || !month.toString().equals(savedMonth))
        throw new ResponseStatusException(
            HttpStatus.CONFLICT, "clientMessageId đã được dùng cho nội dung hoặc kỳ khác");
      assistant = pair(user, conversation, input.clientMessageId(), "ASSISTANT").getFirst();
      if (!"FAILED".equals(assistant.status))
        return new Prepared(
            user,
            conversation,
            assistant.id,
            assistant.attemptToken,
            Map.of(),
            messageView(assistant),
            false);
    } else {
      human = new ChatMessage();
      human.userId = user;
      human.conversationId = conversation;
      human.role = "USER";
      human.content = input.content().trim();
      human.status = "COMPLETED";
      human.clientMessageId = input.clientMessageId();
      human.metadata = serialize(Map.of("month", month.toString()));
      assistant = new ChatMessage();
      assistant.userId = user;
      assistant.conversationId = conversation;
      assistant.role = "ASSISTANT";
      assistant.clientMessageId = input.clientMessageId();
    }
    if (external && !consent)
      throw new ResponseStatusException(
          HttpStatus.FORBIDDEN,
          "Cần đồng ý gửi dữ liệu tối thiểu tới nhà cung cấp AI bên ngoài trong cài đặt chat.");
    limit(user);
    var snapshot = context.snapshot(user, month, consent);
    var attempt = UUID.randomUUID().toString();
    assistant.content = "";
    assistant.status = "PENDING";
    assistant.attemptToken = attempt;
    assistant.modelVersion = null;
    assistant.metadata =
        serialize(
            Map.of(
                "period",
                month.toString(),
                "retrievedAt",
                snapshot.get("asOf"),
                "sources",
                snapshot.get("sources"),
                "external",
                external));
    assistant.updatedAt = LocalDateTime.now();
    if (human.id == null) {
      em.persist(human);
      em.persist(assistant);
    }
    c.updatedAt = LocalDateTime.now();
    if (c.title.equals("Cuộc trò chuyện mới"))
      c.title = human.content.substring(0, Math.min(human.content.length(), 60));
    em.flush();
    var previous =
        em.createQuery(
                "from ChatMessage m where m.userId=:u and m.conversationId=:c and"
                    + " m.status='COMPLETED' and m.clientMessageId<>:k and exists (select a.id from"
                    + " ChatMessage a where a.userId=:u and a.conversationId=:c and"
                    + " a.clientMessageId=m.clientMessageId and a.role='ASSISTANT' and"
                    + " a.status='COMPLETED') order by m.id desc",
                ChatMessage.class)
            .setParameter("u", user)
            .setParameter("c", conversation)
            .setParameter("k", input.clientMessageId())
            .setMaxResults(20)
            .getResultList();
    var history = new ArrayList<Map<String, String>>();
    for (var m : previous.reversed())
      history.add(
          Map.of(
              "role",
              m.role.toLowerCase(Locale.ROOT),
              "content",
              m.content.substring(0, Math.min(m.content.length(), 4000))));
    var payload =
        Map.<String, Object>of(
            "message",
            human.content,
            "history",
            history,
            "context",
            snapshot,
            "requestId",
            attempt,
            "externalConsent",
            consent);
    return new Prepared(
        user, conversation, assistant.id, attempt, payload, messageView(assistant), true);
  }

  public Map<String, Object> finish(Prepared prepared, Map<String, Object> result, boolean failed) {
    finance.lockUser(prepared.userId());
    var m = finance.owned(ChatMessage.class, prepared.assistantId(), prepared.userId());
    // Refresh even when OpenEntityManagerInView keeps the preparing request's entities around.
    // The user lock serializes finalization with cancel, consent changes, rename, and deletion.
    em.refresh(m);
    if (!"PENDING".equals(m.status) || !Objects.equals(m.attemptToken, prepared.attemptToken()))
      return messageView(m);
    // Consent revocation while a remote request runs also prevents committing its result.
    if (Boolean.TRUE.equals(metadata(m.metadata).get("external")) && !consent(prepared.userId())) {
      m.status = "CANCELLED";
      m.content = "Đã dừng do thay đổi quyền riêng tư.";
    } else if (failed) {
      m.status = "FAILED";
      m.content =
          "Chưa nhận được phản hồi AI. Kiểm tra cấu hình hoặc thử lại; dữ liệu tài chính vẫn được"
              + " giữ nguyên.";
    } else {
      m.status = "COMPLETED";
      m.content = (String) result.get("content");
      m.modelVersion = (String) result.get("modelVersion");
      var info = metadata(m.metadata);
      if (result.get("metadata") instanceof Map<?, ?> incoming) {
        for (var key :
            List.of(
                "period",
                "retrievedAt",
                "sources",
                "facts",
                "mlModelVersion",
                "mlStatus",
                "fineTuned",
                "responseMode",
                "followUpResolved",
                "knowledgeTopics",
                "provider",
                "grounding",
                "limits",
                "warnings",
                "forecast",
                "anomalies",
                "trainingSource")) if (incoming.containsKey(key)) info.put(key, incoming.get(key));
      }
      if (result.get("provider") instanceof String provider) info.put("provider", provider);
      m.metadata = serialize(info);
    }
    m.attemptToken = null;
    m.updatedAt = LocalDateTime.now();
    var conversation =
        finance.owned(ChatConversation.class, prepared.conversationId(), prepared.userId());
    em.refresh(conversation);
    conversation.updatedAt = LocalDateTime.now();
    return messageView(m);
  }

  public Cancelled cancel(long user, long conversation, Cancel input) {
    finance.lockUser(user);
    finance.owned(ChatConversation.class, conversation, user);
    var messages = pair(user, conversation, input.clientMessageId(), "ASSISTANT");
    if (messages.isEmpty())
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy tin nhắn");
    var m = messages.getFirst();
    String requestId = null;
    if ("PENDING".equals(m.status)) {
      requestId = m.attemptToken;
      m.attemptToken = null;
      m.status = "CANCELLED";
      m.content = "Bạn đã dừng phản hồi này.";
      m.updatedAt = LocalDateTime.now();
    }
    return new Cancelled(messageView(m), requestId);
  }

  public Object feedback(long user, long messageId, Feedback input) {
    if (input.rating() != 1 && input.rating() != -1)
      throw FinanceService.bad("Đánh giá phải là hữu ích hoặc chưa hữu ích");
    finance.lockUser(user);
    var message = finance.owned(ChatMessage.class, messageId, user);
    if (!message.role.equals("ASSISTANT") || !message.status.equals("COMPLETED"))
      throw FinanceService.bad("Chỉ đánh giá phản hồi AI đã hoàn tất");
    var rows =
        em.createQuery("from ChatFeedback where userId=:u and messageId=:m", ChatFeedback.class)
            .setParameter("u", user)
            .setParameter("m", messageId)
            .getResultList();
    var feedback = rows.isEmpty() ? new ChatFeedback() : rows.getFirst();
    feedback.userId = user;
    feedback.messageId = messageId;
    feedback.rating = input.rating();
    feedback.comment = input.comment() == null ? "" : input.comment().trim();
    if (rows.isEmpty()) em.persist(feedback);
    return Map.of(
        "messageId",
        messageId,
        "rating",
        feedback.rating,
        "comment",
        feedback.comment,
        "trainingUse",
        false);
  }
}
