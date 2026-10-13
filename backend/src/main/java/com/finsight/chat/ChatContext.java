package com.finsight.chat;

import com.finsight.model.Entities.*;
import com.finsight.transaction.FinanceService;
import jakarta.persistence.EntityManager;
import java.math.*;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.stereotype.Component;

/**
 * An owned read-only financial snapshot. No user identifiers or free-form ledger text leave here.
 */
@Component
public class ChatContext {
  private final EntityManager em;
  private final FinanceService finance;

  public ChatContext(EntityManager em, FinanceService finance) {
    this.em = em;
    this.finance = finance;
  }

  private BigDecimal sum(long user, String type, LocalDateTime start, LocalDateTime end) {
    return em.createQuery(
            "select coalesce(sum(t.amount),0) from Transaction t where t.userId=:u"
                + " and t.type=:type and t.occurredAt>=:start and t.occurredAt<:end",
            BigDecimal.class)
        .setParameter("u", user)
        .setParameter("type", type)
        .setParameter("start", start)
        .setParameter("end", end)
        .getSingleResult();
  }

  private BigDecimal total(long user, String entity, String field) {
    return em.createQuery(
            "select coalesce(sum(" + field + "),0) from " + entity + " where userId=:u",
            BigDecimal.class)
        .setParameter("u", user)
        .getSingleResult();
  }

  private String money(BigDecimal amount) {
    return amount.setScale(2, RoundingMode.HALF_UP).toPlainString();
  }

  private Map<String, Object> fact(
      String id, String label, Object value, String kind, String source) {
    return Map.of(
        "id",
        id,
        "label",
        label,
        "value",
        value instanceof BigDecimal b ? money(b) : value.toString(),
        "kind",
        kind.equals("COUNT") ? "count" : kind.equals("PERCENT") ? "percent" : "money",
        "nature",
        kind.equals("SCENARIO") ? "SCENARIO" : "ACTUAL",
        "source",
        source);
  }

  private Map<String, String> source(String id, String label, String url) {
    return Map.of("id", id, "label", label, "url", url);
  }

  public Map<String, Object> snapshot(long user, YearMonth month, boolean consent) {
    var now = LocalDateTime.now();
    var start = month.atDay(1).atStartOfDay();
    var monthEnd = start.plusMonths(1);
    var end = monthEnd.isBefore(now) ? monthEnd : now.plusNanos(1000);
    var income = sum(user, "INCOME", start, end);
    var expense = sum(user, "EXPENSE", start, end);
    var balance = total(user, "Wallet", "balance");
    var reserved = total(user, "Contribution", "amount");
    var last30 = sum(user, "INCOME", now.minusDays(30), now.plusNanos(1000));
    var facts = new ArrayList<Map<String, Object>>();
    facts.add(fact("income", "Thu nhập trong kỳ", income, "ACTUAL", "ledger"));
    facts.add(fact("expense", "Chi tiêu trong kỳ", expense, "ACTUAL", "ledger"));
    facts.add(
        fact(
            "remaining",
            "Thu nhập trừ chi tiêu trong kỳ",
            income.subtract(expense),
            "ACTUAL",
            "ledger"));
    facts.add(fact("balance", "Tổng số dư ví hiện tại", balance, "ACTUAL", "wallets"));
    facts.add(
        fact(
            "reservedSavings", "Tổng tiền đã góp tiết kiệm hiện tại", reserved, "ACTUAL", "goals"));
    facts.add(
        fact(
            "netAssets",
            "Số dư ví cộng tiền đã góp tiết kiệm hiện tại",
            balance.add(reserved),
            "ACTUAL",
            "wallets"));
    facts.add(
        fact(
            "incomeLast30Days",
            "Thu nhập trong ba mươi ngày gần nhất",
            last30,
            "ACTUAL",
            "ledger"));
    var monthlyBudget =
        em.createQuery(
                "select coalesce(sum(b.amount),0) from Budget b where b.userId=:u and b.month=:m",
                BigDecimal.class)
            .setParameter("u", user)
            .setParameter("m", month.toString())
            .getSingleResult();
    var budgetSpent =
        em.createQuery(
                "select coalesce(sum(t.amount),0) from Transaction t where t.userId=:u and"
                    + " t.type='EXPENSE' and t.occurredAt>=:start and t.occurredAt<:end and exists"
                    + " (select b.id from Budget b where b.userId=:u and b.month=:m and"
                    + " b.categoryId=t.categoryId)",
                BigDecimal.class)
            .setParameter("u", user)
            .setParameter("m", month.toString())
            .setParameter("start", start)
            .setParameter("end", end)
            .getSingleResult();
    facts.add(
        fact(
            "monthlyBudget", "Tổng ngân sách đã đặt trong kỳ", monthlyBudget, "ACTUAL", "budgets"));
    facts.add(
        fact(
            "budgetSpent",
            "Đã chi trong các danh mục có ngân sách",
            budgetSpent,
            "ACTUAL",
            "budgets"));
    facts.add(
        fact(
            "budgetRemaining",
            "Ngân sách còn lại trong kỳ",
            monthlyBudget.subtract(budgetSpent),
            "ACTUAL",
            "budgets"));

    var categoryRows =
        em.createQuery(
                "select c.id,c.name,sum(t.amount) from Transaction t, Category c where t.userId=:u"
                    + " and c.userId=:u and c.id=t.categoryId and t.type='EXPENSE' and"
                    + " t.occurredAt>=:start and t.occurredAt<:end group by c.id,c.name order by"
                    + " sum(t.amount) desc,c.id asc",
                Object[].class)
            .setParameter("u", user)
            .setParameter("start", start)
            .setParameter("end", end)
            .setMaxResults(10)
            .getResultList();
    var categories = new ArrayList<Map<String, Object>>();
    for (var row : categoryRows) {
      var id = ((Number) row[0]).longValue();
      var amount = (BigDecimal) row[2];
      categories.add(Map.of("id", id, "name", row[1], "amount", money(amount)));
      facts.add(fact("category_" + id, "Chi danh mục " + row[1], amount, "ACTUAL", "ledger"));
    }
    var wallets =
        em
            .createQuery("from Wallet where userId=:u order by id", Wallet.class)
            .setParameter("u", user)
            .setMaxResults(10)
            .getResultList()
            .stream()
            .map(
                w -> {
                  facts.add(
                      fact("wallet_" + w.id, "Số dư ví " + w.name, w.balance, "ACTUAL", "wallets"));
                  return Map.<String, Object>of(
                      "id",
                      w.id,
                      "name",
                      w.name,
                      "balance",
                      money(w.balance),
                      "archived",
                      w.archived);
                })
            .toList();

    var budgetRows =
        em.createQuery("from Budget where userId=:u and month=:m order by id", Budget.class)
            .setParameter("u", user)
            .setParameter("m", month.toString())
            .setMaxResults(10)
            .getResultList();
    var budgets = new ArrayList<Map<String, Object>>();
    for (var b : budgetRows) {
      var category = finance.owned(Category.class, b.categoryId, user);
      var spent =
          em.createQuery(
                  "select coalesce(sum(t.amount),0) from Transaction t where t.userId=:u and"
                      + " t.categoryId=:c and t.type='EXPENSE' and t.occurredAt>=:start and"
                      + " t.occurredAt<:end",
                  BigDecimal.class)
              .setParameter("u", user)
              .setParameter("c", b.categoryId)
              .setParameter("start", start)
              .setParameter("end", end)
              .getSingleResult();
      var remaining = b.amount.subtract(spent);
      var percentage =
          b.amount.signum() > 0
              ? spent
                  .multiply(new BigDecimal("100"))
                  .divide(b.amount, 2, RoundingMode.HALF_UP)
                  .toPlainString()
              : "0.00";
      budgets.add(
          Map.of(
              "id",
              b.id,
              "category",
              category.name,
              "amount",
              money(b.amount),
              "spent",
              money(spent),
              "remaining",
              money(remaining),
              "percentage",
              percentage));
      facts.add(
          fact(
              "budget_" + b.id + "_amount",
              "Ngân sách " + category.name,
              b.amount,
              "ACTUAL",
              "budgets"));
      facts.add(
          fact(
              "budget_" + b.id + "_spent",
              "Đã chi ngân sách " + category.name,
              spent,
              "ACTUAL",
              "budgets"));
      facts.add(
          fact(
              "budget_" + b.id + "_remaining",
              "Còn lại ngân sách " + category.name,
              remaining,
              "ACTUAL",
              "budgets"));
      facts.add(
          fact(
              "budget_" + b.id + "_percentage",
              "Tỷ lệ sử dụng ngân sách " + category.name,
              percentage,
              "PERCENT",
              "budgets"));
    }

    var goals = new ArrayList<Map<String, Object>>();
    for (var g :
        em.createQuery("from SavingsGoal where userId=:u order by id", SavingsGoal.class)
            .setParameter("u", user)
            .setMaxResults(10)
            .getResultList()) {
      var saved =
          em.createQuery(
                  "select coalesce(sum(amount),0) from Contribution where userId=:u and goalId=:g",
                  BigDecimal.class)
              .setParameter("u", user)
              .setParameter("g", g.id)
              .getSingleResult();
      long months = Math.max(1, ChronoUnit.MONTHS.between(now.toLocalDate(), g.dueDate) + 1);
      var plan =
          g.targetAmount
              .subtract(saved)
              .max(BigDecimal.ZERO)
              .divide(BigDecimal.valueOf(months), 2, RoundingMode.CEILING);
      goals.add(
          Map.of(
              "id",
              g.id,
              "name",
              g.name,
              "targetAmount",
              money(g.targetAmount),
              "saved",
              money(saved),
              "dueDate",
              g.dueDate.toString(),
              "monthlyPlan",
              money(plan)));
      facts.add(
          fact(
              "goal_" + g.id + "_target", "Mục tiêu " + g.name, g.targetAmount, "ACTUAL", "goals"));
      facts.add(fact("goal_" + g.id + "_saved", "Đã góp cho " + g.name, saved, "ACTUAL", "goals"));
      facts.add(
          fact(
              "goal_" + g.id + "_monthly",
              "Kế hoạch chia đều theo tháng cho " + g.name,
              plan,
              "SCENARIO",
              "goals"));
    }
    var alertCount =
        em.createQuery(
                "select count(a) from Alert a where a.userId=:u and a.status='OPEN'", Long.class)
            .setParameter("u", user)
            .getSingleResult();
    facts.add(
        fact("openAlerts", "Số tín hiệu bất thường chưa xem lại", alertCount, "COUNT", "alerts"));
    var alerts =
        em
            .createQuery(
                "from Alert where userId=:u and status='OPEN' order by id desc", Alert.class)
            .setParameter("u", user)
            .setMaxResults(10)
            .getResultList()
            .stream()
            .map(
                a ->
                    Map.<String, Object>of(
                        "id",
                        a.id,
                        "transactionId",
                        a.transactionId,
                        "severity",
                        a.severity,
                        "status",
                        a.status))
            .toList();
    var count =
        em.createQuery(
                "select count(t) from Transaction t where t.userId=:u and t.type='EXPENSE' and"
                    + " t.occurredAt<=:now",
                Long.class)
            .setParameter("u", user)
            .setParameter("now", now)
            .getSingleResult();
    var expenseRows =
        em.createQuery(
                "from Transaction where userId=:u and type='EXPENSE' and occurredAt<=:now order by"
                    + " occurredAt desc,id desc",
                Transaction.class)
            .setParameter("u", user)
            .setParameter("now", now)
            .setMaxResults(1000)
            .getResultList();
    var categoryNames = new HashMap<Long, String>();
    var transactions =
        expenseRows.stream()
            .map(
                t ->
                    Map.<String, Object>of(
                        "id",
                        t.id,
                        "amount",
                        money(t.amount),
                        "occurredAt",
                        t.occurredAt.toString(),
                        "category",
                        categoryNames.computeIfAbsent(
                            t.categoryId, id -> finance.owned(Category.class, id, user).name),
                        "recurring",
                        t.recurringId != null))
            .toList();
    var recurring = new TreeMap<String, BigDecimal>();
    for (var r :
        em.createQuery(
                "from Recurring where userId=:u and enabled=true and type='EXPENSE' order by id",
                Recurring.class)
            .setParameter("u", user)
            .setMaxResults(100)
            .getResultList()) {
      if (r.intervalDays < 1) continue;
      var date = r.nextDate;
      if (!date.isAfter(now.toLocalDate())) {
        long skip = ChronoUnit.DAYS.between(date, now.toLocalDate()) / r.intervalDays + 1;
        date = date.plusDays(skip * r.intervalDays);
      }
      for (; !date.isAfter(now.toLocalDate().plusDays(30)); date = date.plusDays(r.intervalDays))
        recurring.merge(date.toString(), r.amount, BigDecimal::add);
    }
    var recurringAmounts = new TreeMap<String, String>();
    recurring.forEach((k, v) -> recurringAmounts.put(k, money(v)));
    var result = new LinkedHashMap<String, Object>();
    result.put("month", month.toString());
    result.put("asOf", now.atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toOffsetDateTime().toString());
    result.put(
        "sources",
        List.of(
            source("ledger", "Giao dịch đã ghi nhận trong kỳ", "/transactions"),
            source("wallets", "Số dư ví hiện tại", "/wallets"),
            source("budgets", "Ngân sách trong kỳ", "/budgets"),
            source("goals", "Mục tiêu tiết kiệm hiện tại", "/savings"),
            source("alerts", "Tín hiệu bất thường đã lưu", "/anomalies")));
    result.put("facts", facts);
    result.put("categoryExpenses", categories);
    result.put("wallets", wallets);
    result.put("budgets", budgets);
    result.put("goals", goals);
    result.put("openAlerts", alerts);
    result.put("transactions", transactions);
    result.put("transactionCount", count);
    result.put("transactionsTruncated", count > 1000);
    result.put("detailLimit", 10);
    result.put("incomeLast30Days", money(last30));
    result.put("recurring", recurringAmounts);
    result.put("externalConsent", consent);
    return result;
  }
}
