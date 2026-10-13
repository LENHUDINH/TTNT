package com.finsight.config;

import com.finsight.auth.AuthController;
import com.finsight.model.Entities.*;
import com.finsight.transaction.FinanceService;
import jakarta.persistence.EntityManager;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/demo")
public class DemoController {
  private final EntityManager em;
  private final FinanceService f;
  private final AuthController auth;
  private final boolean enabled;

  public DemoController(
      EntityManager e,
      FinanceService f,
      AuthController a,
      @Value("${finsight.demo-enabled}") boolean b) {
    em = e;
    this.f = f;
    auth = a;
    enabled = b;
  }

  public record Row(
      @NotBlank @Size(max = 100) String category,
      @NotBlank @Size(max = 250) String description,
      @NotNull @DecimalMin("0.01") @Digits(integer = 15, fraction = 2) BigDecimal amount,
      @NotBlank @Pattern(regexp = "INCOME|EXPENSE") String type,
      @NotNull LocalDateTime occurredAt) {}

  public record Seed(@NotNull @Size(min = 1, max = 5000) List<@Valid Row> transactions) {}

  private User demo(Authentication a) {
    var u = auth.current(a);
    if (!enabled || !u.email.matches("demo\\d{2}@finsight\\.local"))
      throw new org.springframework.web.server.ResponseStatusException(
          org.springframework.http.HttpStatus.FORBIDDEN,
          "Chỉ dành cho tài khoản demo khi DEMO_ENABLED=true");
    return u;
  }

  @PostMapping("/seed")
  @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
  Object seed(Authentication a, @Valid @RequestBody Seed p) {
    var u = demo(a);
    f.lockUser(u.id);
    if (!f.list(Transaction.class, u.id).isEmpty())
      throw new org.springframework.web.server.ResponseStatusException(
          org.springframework.http.HttpStatus.CONFLICT,
          "Demo đã có dữ liệu; dùng reset để nạp lại");
    var cats = new HashMap<String, Long>();
    f.list(Category.class, u.id).forEach(c -> cats.put(c.name, c.id));
    var bank = new Wallet();
    bank.userId = u.id;
    bank.name = "Tài khoản ngân hàng demo";
    bank.type = "BANK";
    bank.balance = BigDecimal.ZERO;
    em.persist(bank);
    var cash = new Wallet();
    cash.userId = u.id;
    cash.name = "Tiền mặt";
    cash.type = "CASH";
    cash.balance = new BigDecimal("1000000.00");
    em.persist(cash);
    int count = 0;
    var rows = p.transactions().stream().sorted(Comparator.comparing(Row::occurredAt)).toList();
    for (var r : rows) {
      if (!cats.containsKey(r.category())) throw FinanceService.bad("Danh mục demo không hợp lệ");
      var t = new Transaction();
      t.userId = u.id;
      t.walletId = bank.id;
      t.categoryId = cats.get(r.category());
      t.description = r.description();
      t.type = r.type();
      t.amount = r.amount();
      t.occurredAt = r.occurredAt();
      t.idempotencyKey = "demo:" + count++;
      bank.balance = bank.balance.add(t.type.equals("INCOME") ? t.amount : t.amount.negate());
      if (bank.balance.signum() < 0) throw FinanceService.bad("Demo tạo số dư âm");
      em.persist(t);
    }
    for (String cat : List.of("Ăn uống", "Mua sắm", "Đi lại", "Nhà ở")) {
      var b = new Budget();
      b.userId = u.id;
      b.categoryId = cats.get(cat);
      b.month = YearMonth.now().toString();
      b.amount = new BigDecimal(cat.equals("Nhà ở") ? "3000000" : "1800000");
      em.persist(b);
    }
    var g = new SavingsGoal();
    g.userId = u.id;
    g.name = "Quỹ dự phòng";
    g.targetAmount = new BigDecimal("30000000");
    g.dueDate = LocalDate.now().plusMonths(6);
    em.persist(g);
    em.flush();
    f.audit(u.id, "DEMO_SEED", "user", u.id);
    return Map.of("seeded", count);
  }

  @PostMapping("/reset")
  @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
  Object reset(Authentication a) {
    var u = demo(a);
    f.lockUser(u.id);
    for (String table :
        List.of(
            "anomaly_alerts",
            "classification_feedback",
            "savings_contributions",
            "ai_predictions",
            "notifications",
            "audit_logs",
            "transfers",
            "transactions",
            "recurring_transactions",
            "budgets",
            "savings_goals",
            "wallets"))
      em.createNativeQuery("DELETE FROM " + table + " WHERE user_id=:u")
          .setParameter("u", u.id)
          .executeUpdate();
    return Map.of("status", "reset", "scope", u.email);
  }
}
