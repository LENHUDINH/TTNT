package com.finsight.transaction;

import com.finsight.model.Entities.*;
import com.finsight.transaction.FinanceRequests.*;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class FinanceService {
  private final EntityManager em;

  public FinanceService(EntityManager e) {
    em = e;
  }

  public static ResponseStatusException bad(String m) {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, m);
  }

  public void lockUser(long u) {
    if (em.find(User.class, u, LockModeType.PESSIMISTIC_WRITE) == null)
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
  }

  public <T> List<T> list(Class<T> type, long u) {
    return em.createQuery(
            "from " + type.getSimpleName() + " where userId=:u order by id desc", type)
        .setParameter("u", u)
        .getResultList();
  }

  public <T> T owned(Class<T> t, long id, long u) {
    var r =
        em.createQuery("from " + t.getSimpleName() + " where id=:id and userId=:u", t)
            .setParameter("id", id)
            .setParameter("u", u)
            .getResultList();
    if (r.isEmpty())
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy dữ liệu");
    return r.getFirst();
  }

  private Wallet wallet(long id, long u, boolean active) {
    var w = owned(Wallet.class, id, u);
    em.lock(w, LockModeType.PESSIMISTIC_WRITE);
    if (active && w.archived) throw bad("Ví đã được lưu trữ");
    return w;
  }

  private void change(Wallet w, BigDecimal delta) {
    var balance = w.balance.add(delta);
    if (balance.signum() < 0) throw bad("Số dư ví không đủ");
    w.balance = balance;
  }

  public void audit(long u, String action, String entity, Long id) {
    var a = new AuditLog();
    a.userId = u;
    a.action = action;
    a.entityType = entity;
    a.entityId = id;
    em.persist(a);
  }

  public void notify(long u, String key, String text) {
    if (em.createQuery(
                "select count(n) from Notification n where n.userId=:u and n.dedupKey=:k",
                Long.class)
            .setParameter("u", u)
            .setParameter("k", key)
            .getSingleResult()
        == 0) {
      var n = new Notification();
      n.userId = u;
      n.dedupKey = key;
      n.message = text;
      em.persist(n);
    }
  }

  private String key(String k) {
    if (k == null || k.isBlank() || k.length() > 100)
      throw bad("Cần Idempotency-Key (tối đa 100 ký tự)");
    return k;
  }

  public Wallet createWallet(long u, WalletInput p) {
    lockUser(u);
    var w = new Wallet();
    w.userId = u;
    w.name = p.name().trim();
    w.type = p.type();
    w.balance = p.initialBalance();
    em.persist(w);
    audit(u, "CREATE", "wallet", w.id);
    return w;
  }

  public Wallet updateWallet(long u, long id, WalletInput p) {
    lockUser(u);
    var w = wallet(id, u, true);
    w.name = p.name().trim();
    w.type = p.type();
    audit(u, "UPDATE", "wallet", id);
    return w;
  }

  public void archiveWallet(long u, long id) {
    lockUser(u);
    var w = wallet(id, u, true);
    if (list(Contribution.class, u).stream().anyMatch(c -> c.walletId.equals(id)))
      throw bad(
          "Ví đang giữ nguồn đóng góp tiết kiệm; hoàn tất hoặc xóa mục tiêu trước khi lưu trữ");
    if (w.balance.signum() != 0) throw bad("Chuyển hết số dư trước khi lưu trữ ví");
    if (list(Recurring.class, u).stream().anyMatch(r -> r.walletId == id && r.enabled))
      throw bad("Tắt giao dịch định kỳ của ví trước");
    w.archived = true;
    audit(u, "ARCHIVE", "wallet", id);
  }

  private BigDecimal delta(Transaction t) {
    return t.type.equals("INCOME") ? t.amount : t.amount.negate();
  }

  public Transaction addTransaction(long u, TransactionInput p, String k) {
    lockUser(u);
    key(k);
    var existing =
        em.createQuery("from Transaction where userId=:u and idempotencyKey=:k", Transaction.class)
            .setParameter("u", u)
            .setParameter("k", k)
            .getResultList();
    if (!existing.isEmpty()) {
      var t = existing.getFirst();
      if (!t.walletId.equals(p.walletId())
          || !t.categoryId.equals(p.categoryId())
          || !t.type.equals(p.type())
          || t.amount.compareTo(p.amount()) != 0
          || !t.description.equals(p.description().trim())
          || !t.occurredAt.equals(p.occurredAt().truncatedTo(java.time.temporal.ChronoUnit.MICROS)))
        throw new ResponseStatusException(
            HttpStatus.CONFLICT, "Idempotency-Key đã dùng cho dữ liệu khác");
      return t;
    }
    var w = wallet(p.walletId(), u, true);
    owned(Category.class, p.categoryId(), u);
    var t = new Transaction();
    t.userId = u;
    t.walletId = w.id;
    t.categoryId = p.categoryId();
    t.type = p.type();
    t.amount = p.amount();
    t.description = p.description().trim();
    t.occurredAt = p.occurredAt().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
    t.idempotencyKey = k;
    change(w, delta(t));
    em.persist(t);
    em.flush();
    audit(u, "CREATE", "transaction", t.id);
    invalidate(u);
    checkBudgets(u);
    return t;
  }

  public Transaction updateTransaction(long u, long id, TransactionInput p) {
    lockUser(u);
    var t = owned(Transaction.class, id, u);
    var old = wallet(t.walletId, u, false);
    var next = wallet(p.walletId(), u, true);
    owned(Category.class, p.categoryId(), u);
    // Apply net delta once for edits in the same wallet, so a spent income cannot be temporarily
    // withdrawn.
    BigDecimal newDelta = p.type().equals("INCOME") ? p.amount() : p.amount().negate();
    if (old.id.equals(next.id)) change(old, newDelta.subtract(delta(t)));
    else {
      change(old, delta(t).negate());
      change(next, newDelta);
    }
    t.walletId = p.walletId();
    t.categoryId = p.categoryId();
    t.type = p.type();
    t.amount = p.amount();
    t.description = p.description().trim();
    t.occurredAt = p.occurredAt().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
    em.createQuery("delete from Alert where userId=:u and transactionId=:id")
        .setParameter("u", u)
        .setParameter("id", id)
        .executeUpdate();
    audit(u, "UPDATE", "transaction", id);
    em.flush();
    invalidate(u);
    checkBudgets(u);
    return t;
  }

  public void deleteTransaction(long u, long id) {
    lockUser(u);
    var t = owned(Transaction.class, id, u);
    change(wallet(t.walletId, u, false), delta(t).negate());
    em.createQuery("delete from Alert where userId=:u and transactionId=:id")
        .setParameter("u", u)
        .setParameter("id", id)
        .executeUpdate();
    em.remove(t);
    audit(u, "DELETE", "transaction", id);
    em.flush();
    invalidate(u);
    checkBudgets(u);
  }

  public Transfer transfer(long u, TransferInput p, String k) {
    lockUser(u);
    key(k);
    if (p.fromWalletId().equals(p.toWalletId())) throw bad("Chọn hai ví khác nhau");
    var existing =
        em.createQuery("from Transfer where userId=:u and idempotencyKey=:k", Transfer.class)
            .setParameter("u", u)
            .setParameter("k", k)
            .getResultList();
    if (!existing.isEmpty()) {
      var t = existing.getFirst();
      if (!t.fromWalletId.equals(p.fromWalletId())
          || !t.toWalletId.equals(p.toWalletId())
          || t.amount.compareTo(p.amount()) != 0
          || !t.note.equals(p.note() == null ? "" : p.note()))
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Idempotency-Key đã dùng");
      return t;
    }
    var first = wallet(Math.min(p.fromWalletId(), p.toWalletId()), u, true);
    var second = wallet(Math.max(p.fromWalletId(), p.toWalletId()), u, true);
    var from = first.id.equals(p.fromWalletId()) ? first : second;
    var to = first == from ? second : first;
    change(from, p.amount().negate());
    change(to, p.amount());
    var t = new Transfer();
    t.userId = u;
    t.fromWalletId = from.id;
    t.toWalletId = to.id;
    t.amount = p.amount();
    t.note = p.note() == null ? "" : p.note();
    t.idempotencyKey = k;
    em.persist(t);
    audit(u, "TRANSFER", "wallet", from.id);
    return t;
  }

  public Category category(long u, CategoryInput p) {
    lockUser(u);
    var c = new Category();
    c.userId = u;
    c.name = p.name().trim();
    em.persist(c);
    return c;
  }

  public Budget budget(long u, Long id, BudgetInput p) {
    lockUser(u);
    YearMonth.parse(p.month());
    owned(Category.class, p.categoryId(), u);
    var b = id == null ? new Budget() : owned(Budget.class, id, u);
    b.userId = u;
    b.categoryId = p.categoryId();
    b.month = p.month();
    b.amount = p.amount();
    if (id == null) em.persist(b);
    em.flush();
    checkBudgets(u);
    audit(u, id == null ? "CREATE" : "UPDATE", "budget", b.id);
    return b;
  }

  public Map<String, Object> budgetView(Budget b) {
    var start = YearMonth.parse(b.month).atDay(1).atStartOfDay();
    var end = start.plusMonths(1);
    var spent =
        em.createQuery(
                "select coalesce(sum(amount),0) from Transaction where userId=:u and categoryId=:c"
                    + " and type='EXPENSE' and occurredAt>=:s and occurredAt<:e",
                BigDecimal.class)
            .setParameter("u", b.userId)
            .setParameter("c", b.categoryId)
            .setParameter("s", start)
            .setParameter("e", end)
            .getSingleResult();
    return Map.of(
        "id",
        b.id,
        "categoryId",
        b.categoryId,
        "month",
        b.month,
        "amount",
        b.amount,
        "spent",
        spent,
        "percentage",
        spent.doubleValue() / b.amount.doubleValue() * 100);
  }

  private void checkBudgets(long u) {
    for (var b : list(Budget.class, u)) {
      var v = budgetView(b);
      double pct = (double) v.get("percentage");
      int threshold = pct >= 100 ? 100 : pct >= 90 ? 90 : pct >= 70 ? 70 : 0;
      if (threshold > 0)
        notify(
            u,
            "budget:" + b.id + ":" + threshold,
            "Ngân sách "
                + owned(Category.class, b.categoryId, u).name
                + " tháng "
                + b.month
                + " đạt ngưỡng "
                + threshold
                + "%");
    }
  }

  public SavingsGoal goal(long u, Long id, GoalInput p) {
    lockUser(u);
    var g = id == null ? new SavingsGoal() : owned(SavingsGoal.class, id, u);
    g.userId = u;
    g.name = p.name().trim();
    g.targetAmount = p.targetAmount();
    g.dueDate = p.dueDate();
    if (id == null) em.persist(g);
    audit(u, id == null ? "CREATE" : "UPDATE", "goal", g.id);
    return g;
  }

  public Map<String, Object> goalView(SavingsGoal g) {
    var cs =
        list(Contribution.class, g.userId).stream().filter(c -> c.goalId.equals(g.id)).toList();
    var saved = cs.stream().map(c -> c.amount).reduce(BigDecimal.ZERO, BigDecimal::add);
    long months =
        Math.max(1, java.time.temporal.ChronoUnit.MONTHS.between(LocalDate.now(), g.dueDate) + 1);
    return Map.of(
        "id",
        g.id,
        "name",
        g.name,
        "targetAmount",
        g.targetAmount,
        "dueDate",
        g.dueDate,
        "saved",
        saved,
        "contributions",
        cs,
        "monthlyPlan",
        g.targetAmount
            .subtract(saved)
            .max(BigDecimal.ZERO)
            .divide(BigDecimal.valueOf(months), 2, java.math.RoundingMode.CEILING),
        "planMethod",
        "Arithmetic savings plan");
  }

  public Contribution contribute(long u, long id, ContributionInput p) {
    lockUser(u);
    owned(SavingsGoal.class, id, u);
    change(wallet(p.walletId(), u, true), p.amount().negate());
    var c = new Contribution();
    c.userId = u;
    c.goalId = id;
    c.walletId = p.walletId();
    c.amount = p.amount();
    c.note = p.note() == null ? "" : p.note();
    em.persist(c);
    audit(u, "CONTRIBUTE", "goal", id);
    return c;
  }

  public void removeGoal(long u, long id) {
    lockUser(u);
    var g = owned(SavingsGoal.class, id, u);
    for (var c : list(Contribution.class, u))
      if (c.goalId.equals(id)) {
        change(wallet(c.walletId, u, false), c.amount);
        em.remove(c);
      }
    em.flush();
    em.remove(g);
    audit(u, "DELETE_REFUND", "goal", id);
  }

  public void removeBudget(long u, long id) {
    lockUser(u);
    em.remove(owned(Budget.class, id, u));
    audit(u, "DELETE", "budget", id);
  }

  private void invalidate(long u) {
    em.createQuery("update Prediction set stale=true where userId=:u")
        .setParameter("u", u)
        .executeUpdate();
  }

  public Map<String, Object> transactions(
      long u,
      String search,
      Long categoryId,
      Long walletId,
      LocalDate from,
      LocalDate to,
      String sort,
      int page,
      int size) {
    if (page < 0 || size < 1 || size > 100) throw bad("Phân trang không hợp lệ");
    String q = "from Transaction t where t.userId=:u";
    var params = new HashMap<String, Object>();
    params.put("u", u);
    if (search != null && !search.isBlank()) {
      q += " and lower(t.description) like :q";
      params.put("q", "%" + search.toLowerCase() + "%");
    }
    if (categoryId != null) {
      q += " and t.categoryId=:c";
      params.put("c", categoryId);
    }
    if (walletId != null) {
      q += " and t.walletId=:w";
      params.put("w", walletId);
    }
    if (from != null) {
      q += " and t.occurredAt>=:s";
      params.put("s", from.atStartOfDay());
    }
    if (to != null) {
      q += " and t.occurredAt<:e";
      params.put("e", to.plusDays(1).atStartOfDay());
    }
    var count = em.createQuery("select count(t) " + q, Long.class);
    String order =
        switch (sort) {
          case "amountAsc" -> "t.amount asc,t.id desc";
          case "amountDesc" -> "t.amount desc,t.id desc";
          case "dateAsc" -> "t.occurredAt asc,t.id asc";
          default -> "t.occurredAt desc,t.id desc";
        };
    var data = em.createQuery(q + " order by " + order, Transaction.class);
    params.forEach(
        (k, v) -> {
          count.setParameter(k, v);
          data.setParameter(k, v);
        });
    return Map.of(
        "items",
        data.setFirstResult(page * size).setMaxResults(size).getResultList(),
        "total",
        count.getSingleResult(),
        "page",
        page,
        "size",
        size);
  }

  public Map<String, Object> dashboard(long u, String month) {
    var ym = YearMonth.parse(month);
    var ts = list(Transaction.class, u);
    var start = ym.atDay(1).atStartOfDay();
    var end = start.plusMonths(1);
    var selected =
        ts.stream()
            .filter(t -> !t.occurredAt.isBefore(start) && t.occurredAt.isBefore(end))
            .toList();
    BigDecimal income = BigDecimal.ZERO, expense = BigDecimal.ZERO;
    var cats = new TreeMap<Long, BigDecimal>();
    var days = new TreeMap<String, Map<String, Object>>();
    for (int day = 1; day <= ym.lengthOfMonth(); day++)
      days.put(
          ym.atDay(day).toString(),
          new HashMap<>(
              Map.of(
                  "date",
                  ym.atDay(day).toString(),
                  "income",
                  BigDecimal.ZERO,
                  "expense",
                  BigDecimal.ZERO)));
    for (var t : selected) {
      String k = t.type.equals("INCOME") ? "income" : "expense";
      var d = days.get(t.occurredAt.toLocalDate().toString());
      d.put(k, ((BigDecimal) d.get(k)).add(t.amount));
      if (k.equals("income")) income = income.add(t.amount);
      else {
        expense = expense.add(t.amount);
        cats.merge(t.categoryId, t.amount, BigDecimal::add);
      }
    }
    var balance =
        list(Wallet.class, u).stream().map(w -> w.balance).reduce(BigDecimal.ZERO, BigDecimal::add);
    var reserved =
        list(Contribution.class, u).stream()
            .map(c -> c.amount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    return Map.ofEntries(
        Map.entry("month", month),
        Map.entry("balance", balance),
        Map.entry("reservedSavings", reserved),
        Map.entry("netAssets", balance.add(reserved)),
        Map.entry("income", income),
        Map.entry("expense", expense),
        Map.entry("remaining", income.subtract(expense)),
        Map.entry("daily", days.values()),
        Map.entry(
            "categories",
            cats.entrySet().stream()
                .map(
                    c ->
                        Map.of(
                            "name",
                            owned(Category.class, c.getKey(), u).name,
                            "amount",
                            c.getValue()))
                .toList()),
        Map.entry(
            "recent",
            ts.stream()
                .sorted(Comparator.comparing((Transaction t) -> t.occurredAt).reversed())
                .limit(6)
                .toList()),
        Map.entry(
            "budgets",
            list(Budget.class, u).stream()
                .filter(b -> b.month.equals(month))
                .map(this::budgetView)
                .toList()),
        Map.entry("goals", list(SavingsGoal.class, u).stream().map(this::goalView).toList()),
        Map.entry(
            "openAlerts",
            list(Alert.class, u).stream().filter(a -> a.status.equals("OPEN")).count()));
  }

  public Recurring recurring(long u, RecurringInput p) {
    lockUser(u);
    wallet(p.walletId(), u, true);
    owned(Category.class, p.categoryId(), u);
    var r = new Recurring();
    r.userId = u;
    r.walletId = p.walletId();
    r.categoryId = p.categoryId();
    r.type = p.type();
    r.amount = p.amount();
    r.description = p.description();
    r.nextDate = p.nextDate();
    r.intervalDays = p.intervalDays();
    r.enabled = true;
    em.persist(r);
    return r;
  }

  public void stopRecurring(long u, long id) {
    lockUser(u);
    owned(Recurring.class, id, u).enabled = false;
  }

  public void executeRecurring(long id) {
    var r = em.find(Recurring.class, id);
    if (r == null) return;
    lockUser(r.userId);
    em.refresh(r);
    if (!r.enabled || r.nextDate.isAfter(LocalDate.now())) return;
    var t =
        addTransaction(
            r.userId,
            new TransactionInput(
                r.walletId, r.categoryId, r.type, r.amount, r.description, r.nextDate.atTime(9, 0)),
            "recurring:" + r.id + ":" + r.nextDate);
    t.recurringId = r.id;
    r.nextDate = r.nextDate.plusDays(r.intervalDays);
  }

  public void markRead(long u, long id) {
    lockUser(u);
    owned(Notification.class, id, u).readFlag = true;
  }

  public void readAll(long u) {
    lockUser(u);
    em.createQuery("update Notification set readFlag=true where userId=:u")
        .setParameter("u", u)
        .executeUpdate();
  }
}
