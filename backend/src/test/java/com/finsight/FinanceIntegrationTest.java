package com.finsight;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.finsight.auth.AuthController;
import com.finsight.model.Entities.*;
import com.finsight.transaction.*;
import com.finsight.transaction.FinanceRequests.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class FinanceIntegrationTest {
  @Autowired FinanceService f;
  @Autowired AuthController auth;
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  User u;
  Wallet w;
  Category c;

  @BeforeEach
  void setup() {
    u =
        auth.register(
            new AuthController.Registration(
                UUID.randomUUID() + "@example.test", "SecurePassword123!", "Tester"));
    w = f.createWallet(u.id, new WalletInput("Cash", "CASH", new BigDecimal("1000")));
    c = f.list(Category.class, u.id).getFirst();
  }

  TransactionInput expense(String amount) {
    return new TransactionInput(
        w.id,
        c.id,
        "EXPENSE",
        new BigDecimal(amount),
        "Expense",
        LocalDateTime.of(2026, 10, 10, 9, 0));
  }

  BigDecimal balance(long id) {
    return f.owned(Wallet.class, id, u.id).balance;
  }

  @Test
  void atomicTransferAndIdempotency() {
    var other = f.createWallet(u.id, new WalletInput("Bank", "BANK", BigDecimal.ZERO));
    var p = new TransferInput(w.id, other.id, new BigDecimal("200"), "");
    var a = f.transfer(u.id, p, "transfer-1");
    var b = f.transfer(u.id, p, "transfer-1");
    assertEquals(a.id, b.id);
    assertEquals(0, balance(w.id).compareTo(new BigDecimal("800")));
    assertEquals(0, balance(other.id).compareTo(new BigDecimal("200")));
    assertEquals(0, f.list(Transaction.class, u.id).size());
  }

  @Test
  void transferFailureRollsBack() {
    var other = f.createWallet(u.id, new WalletInput("Bank", "BANK", BigDecimal.ZERO));
    assertThrows(
        Exception.class,
        () ->
            f.transfer(
                u.id, new TransferInput(w.id, other.id, new BigDecimal("2000"), ""), "too-much"));
    assertEquals(0, balance(w.id).compareTo(new BigDecimal("1000")));
    assertEquals(0, balance(other.id).compareTo(BigDecimal.ZERO));
    assertTrue(f.list(Transfer.class, u.id).isEmpty());
  }

  @Test
  void differentUserCannotUseWallet() {
    var user2 =
        auth.register(
            new AuthController.Registration(
                UUID.randomUUID() + "@example.test", "SecurePassword123!", "Other"));
    assertThrows(Exception.class, () -> f.addTransaction(user2.id, expense("100"), "foreign"));
    assertEquals(0, balance(w.id).compareTo(new BigDecimal("1000")));
  }

  @Test
  void transactionEditDeleteReconciles() {
    var t = f.addTransaction(u.id, expense("100"), "expense-1");
    f.updateTransaction(u.id, t.id, expense("150"));
    assertEquals(0, balance(w.id).compareTo(new BigDecimal("850")));
    f.deleteTransaction(u.id, t.id);
    assertEquals(0, balance(w.id).compareTo(new BigDecimal("1000")));
  }

  @Test
  void expenseReplayDoesNotDuplicate() {
    var p = expense("100");
    assertEquals(f.addTransaction(u.id, p, "same").id, f.addTransaction(u.id, p, "same").id);
    assertThrows(Exception.class, () -> f.addTransaction(u.id, expense("200"), "same"));
    assertEquals(1, f.list(Transaction.class, u.id).size());
    assertEquals(0, balance(w.id).compareTo(new BigDecimal("900")));
  }

  @Test
  void modifyingSpentIncomeAppliesNet() {
    var t =
        f.addTransaction(
            u.id,
            new TransactionInput(
                w.id, c.id, "INCOME", new BigDecimal("500"), "income", LocalDateTime.now()),
            "income");
    f.addTransaction(u.id, expense("1200"), "spent");
    f.updateTransaction(
        u.id,
        t.id,
        new TransactionInput(w.id, c.id, "INCOME", new BigDecimal("550"), "income", t.occurredAt));
    assertEquals(0, balance(w.id).compareTo(new BigDecimal("350")));
  }

  @Test
  void budgetNotificationsAreDeduplicated() {
    f.budget(u.id, null, new BudgetInput(c.id, "2026-10", new BigDecimal("100")));
    f.addTransaction(u.id, expense("71"), "71");
    f.addTransaction(u.id, expense("1"), "1");
    assertEquals(1, f.list(Notification.class, u.id).size());
    f.addTransaction(u.id, expense("20"), "20");
    f.addTransaction(u.id, expense("9"), "9");
    assertEquals(3, f.list(Notification.class, u.id).size());
  }

  @Test
  void savingsRefundPreservesAssets() {
    var g =
        f.goal(
            u.id,
            null,
            new GoalInput("Laptop", new BigDecimal("500"), LocalDate.now().plusMonths(2)));
    f.contribute(u.id, g.id, new ContributionInput(w.id, new BigDecimal("100"), ""));
    assertEquals(0, balance(w.id).compareTo(new BigDecimal("900")));
    assertEquals(new BigDecimal("100.00"), f.goalView(g).get("saved"));
    f.removeGoal(u.id, g.id);
    assertEquals(0, balance(w.id).compareTo(new BigDecimal("1000")));
  }

  @Test
  void concurrentExpensesCannotOverdraw() throws Exception {
    var ex = Executors.newFixedThreadPool(2);
    try {
      var tasks =
          List.<Callable<Boolean>>of(
              () -> {
                try {
                  f.addTransaction(u.id, expense("700"), "concurrent-1");
                  return true;
                } catch (Exception e) {
                  return false;
                }
              },
              () -> {
                try {
                  f.addTransaction(u.id, expense("700"), "concurrent-2");
                  return true;
                } catch (Exception e) {
                  return false;
                }
              });
      int successes = 0;
      for (var v : ex.invokeAll(tasks)) if (v.get()) successes++;
      assertEquals(1, successes);
      assertEquals(0, balance(w.id).compareTo(new BigDecimal("300")));
    } finally {
      ex.shutdown();
    }
  }

  @Test
  void anonymousAndCsrfProtected() throws Exception {
    mvc.perform(get("/api/wallets")).andExpect(status().isUnauthorized());
    mvc.perform(
            post("/api/wallets")
                .with(user(u.email))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(status().isForbidden());
  }

  @Test
  void loginSessionFixationAndLogout() throws Exception {
    var before = new MockHttpSession();
    var r =
        mvc.perform(
                post("/api/auth/login")
                    .session(before)
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        json.writeValueAsString(
                            new AuthController.Login(u.email, "SecurePassword123!"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.passwordHash").doesNotExist())
            .andReturn();
    var session = (MockHttpSession) r.getRequest().getSession();
    mvc.perform(get("/api/wallets").session(session)).andExpect(status().isOk());
    mvc.perform(post("/api/auth/logout").session(session).with(csrf()))
        .andExpect(status().isNoContent());
    assertTrue(session.isInvalid());
  }

  @Test
  void invalidMoneyIsRejected() throws Exception {
    String body =
        "{\"walletId\":"
            + w.id
            + ",\"categoryId\":"
            + c.id
            + ",\"type\":\"EXPENSE\",\"amount\":-10,\"description\":\"bad\",\"occurredAt\":\"2026-10-10T09:00:00\"}";
    mvc.perform(
            post("/api/transactions")
                .with(user(u.email))
                .with(csrf())
                .header("Idempotency-Key", "bad")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isBadRequest());
  }

  @Test
  void aiFailureDoesNotAffectFinance() throws Exception {
    mvc.perform(post("/api/ai/forecast").with(user(u.email)).with(csrf()))
        .andExpect(status().isServiceUnavailable());
    mvc.perform(get("/api/wallets").with(user(u.email))).andExpect(status().isOk());
  }

  @Test
  void monthlyReportExcludesTransfers() {
    var other = f.createWallet(u.id, new WalletInput("Bank", "BANK", BigDecimal.ZERO));
    f.transfer(u.id, new TransferInput(w.id, other.id, new BigDecimal("100"), ""), "xfer");
    var d = f.dashboard(u.id, "2026-10");
    assertEquals(0, ((BigDecimal) d.get("expense")).signum());
    assertEquals(0, ((BigDecimal) d.get("income")).signum());
  }

  @Test
  void reservedSavingsPreventWalletArchive() {
    var g =
        f.goal(
            u.id,
            null,
            new GoalInput("Reserve", new BigDecimal("1000"), LocalDate.now().plusMonths(2)));
    f.contribute(u.id, g.id, new ContributionInput(w.id, new BigDecimal("1000"), ""));
    assertThrows(Exception.class, () -> f.archiveWallet(u.id, w.id));
    f.removeGoal(u.id, g.id);
    assertEquals(0, balance(w.id).compareTo(new BigDecimal("1000")));
  }

  @Test
  void replayCanonicalizesDescriptionAndMicrosecondTimestamp() {
    var p =
        new TransactionInput(
            w.id,
            c.id,
            "EXPENSE",
            new BigDecimal("10"),
            "  Coffee  ",
            LocalDateTime.of(2026, 10, 10, 9, 0, 0, 123456789));
    var first = f.addTransaction(u.id, p, "normalized");
    var replay = f.addTransaction(u.id, p, "normalized");
    assertEquals(first.id, replay.id);
    assertEquals(123456000, replay.occurredAt.getNano());
    assertEquals("Coffee", replay.description);
  }

  @Autowired org.springframework.security.crypto.password.PasswordEncoder passwords;
  @Autowired com.finsight.model.UserRepository users;

  @Test
  void profileAndPasswordConcurrentUpdatesPreserveBoth() throws Exception {
    var authentication =
        new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
            u.email, "unused");
    var request = new org.springframework.mock.web.MockHttpServletRequest();
    request.getSession();
    var executor = Executors.newFixedThreadPool(2);
    try {
      var started = new CountDownLatch(1);
      var password =
          executor.submit(
              () -> {
                started.countDown();
                return auth.password(
                    authentication,
                    new AuthController.Password("SecurePassword123!", "ChangedPassword2026!"),
                    request);
              });
      started.await();
      Thread.sleep(30);
      var profile =
          executor.submit(
              () ->
                  auth.profile(authentication, new AuthController.Profile("Updated Name", "dark")));
      password.get();
      profile.get();
      var updated = users.findById(u.id).orElseThrow();
      assertEquals("Updated Name", updated.name);
      assertEquals("dark", updated.theme);
      assertTrue(passwords.matches("ChangedPassword2026!", updated.passwordHash));
    } finally {
      executor.shutdown();
    }
  }

  @Test
  void recurringRunsOnceAndAdvancesSchedule() {
    var r =
        f.recurring(
            u.id,
            new RecurringInput(
                w.id, c.id, "EXPENSE", new BigDecimal("100"), "Recurring", LocalDate.now(), 7));
    f.executeRecurring(r.id);
    f.executeRecurring(r.id);
    assertEquals(1, f.list(Transaction.class, u.id).size());
    assertEquals(0, balance(w.id).compareTo(new BigDecimal("900")));
    assertEquals(LocalDate.now().plusDays(7), f.owned(Recurring.class, r.id, u.id).nextDate);
  }
}
