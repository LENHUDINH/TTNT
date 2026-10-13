package com.finsight.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.finsight.auth.AuthController;
import com.finsight.model.Entities.*;
import com.finsight.transaction.FinanceService;
import jakarta.persistence.EntityManager;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/ai")
public class AiController {
  private final FinanceService f;
  private final AuthController auth;
  private final EntityManager em;
  private final ObjectMapper json;
  private final RestClient client;

  public AiController(
      FinanceService f,
      AuthController a,
      EntityManager e,
      ObjectMapper j,
      @Value("${finsight.ai-url}") String url,
      @Value("${finsight.ai-key}") String key) {
    this.f = f;
    auth = a;
    em = e;
    json = j;
    var factory = new SimpleClientHttpRequestFactory();
    factory.setConnectTimeout(2000);
    factory.setReadTimeout(10000);
    client =
        RestClient.builder()
            .baseUrl(url)
            .requestFactory(factory)
            .defaultHeader("X-Service-Key", key)
            .build();
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> post(String path, Object payload) {
    try {
      return client
          .post()
          .uri(path)
          .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
          .body(serialize(payload))
          .retrieve()
          .body(Map.class);
    } catch (Exception e) {
      org.slf4j.LoggerFactory.getLogger(getClass())
          .warn("AI request {} failed: {}", path, e.getClass().getSimpleName());
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE,
          "Dịch vụ AI chưa sẵn sàng. Quản lý tài chính vẫn hoạt động.");
    }
  }

  private List<Map<String, Object>> data(long u) {
    var categories = new HashMap<Long, String>();
    f.list(Category.class, u).forEach(c -> categories.put(c.id, c.name));
    return f.list(Transaction.class, u).stream()
        .filter(t -> t.type.equals("EXPENSE") && !t.occurredAt.isAfter(LocalDateTime.now()))
        .map(
            t -> {
              Map<String, Object> m = new HashMap<>();
              m.put("id", t.id);
              m.put("amount", t.amount);
              m.put("occurredAt", t.occurredAt);
              m.put("category", categories.get(t.categoryId));
              m.put("description", t.description);
              m.put("recurring", t.recurringId != null);
              return m;
            })
        .toList();
  }

  private String serialize(Object o) {
    try {
      return json.writeValueAsString(o);
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  private void version(Map<String, Object> r) {
    if (r.get("modelVersion") != null)
      em.createNativeQuery(
              "INSERT INTO model_versions(version,metadata,created_at) VALUES(:v,:m,:d) ON"
                  + " DUPLICATE KEY UPDATE metadata=:m")
          .setParameter("v", r.get("modelVersion"))
          .setParameter(
              "m",
              serialize(
                  Map.of(
                      "metrics",
                      r.getOrDefault("metrics", Map.of()),
                      "source",
                      "Synthetic evaluation")))
          .setParameter("d", LocalDateTime.now())
          .executeUpdate();
  }

  @GetMapping("/models")
  Object models() {
    try {
      return client.get().uri("/models").retrieve().body(Map.class);
    } catch (Exception e) {
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE, "Chưa tải được thông tin mô hình AI");
    }
  }

  @PostMapping("/forecast")
  @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
  Object forecast(Authentication a, @RequestParam(defaultValue = "30") int horizon) {
    if (horizon < 1 || horizon > 30) throw FinanceService.bad("Chọn từ 1 đến 30 ngày");
    long u = auth.current(a).id;
    f.lockUser(u);
    var recurring = new HashMap<String, java.math.BigDecimal>();
    for (var r : f.list(Recurring.class, u))
      if (r.enabled && r.type.equals("EXPENSE")) {
        for (var date = r.nextDate;
            !date.isAfter(LocalDate.now().plusDays(horizon));
            date = date.plusDays(r.intervalDays))
          if (date.isAfter(LocalDate.now()))
            recurring.merge(date.toString(), r.amount, java.math.BigDecimal::add);
      }
    var result =
        post(
            "/forecast",
            Map.of(
                "transactions",
                data(u),
                "horizon",
                horizon,
                "asOf",
                LocalDate.now(),
                "recurring",
                recurring));
    if ("READY".equals(result.get("status"))) {
      var p = new Prediction();
      p.userId = u;
      p.modelVersion = (String) result.get("modelVersion");
      p.payload = serialize(result);
      em.persist(p);
      version(result);
      var month = YearMonth.now().toString();
      double budget =
          f.list(Budget.class, u).stream()
              .filter(b -> b.month.equals(month))
              .mapToDouble(b -> b.amount.doubleValue())
              .sum();
      result.put("monthlyBudget", budget);
      result.put(
          "budgetRisk", budget > 0 && ((Number) result.get("monthEnd")).doubleValue() > budget);
      result.put(
          "budgetRiskMethod",
          "Total monthly forecast versus sum of category budgets; category-specific risk not"
              + " estimated");
    }
    return result;
  }

  @GetMapping("/forecast/history")
  Object history(Authentication a) {
    return f.list(Prediction.class, auth.current(a).id);
  }

  @PostMapping("/savings-plan")
  @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
  Object savingsPlan(Authentication a) {
    long u = auth.current(a).id;
    f.lockUser(u);
    var result =
        post(
            "/forecast",
            Map.of(
                "transactions",
                data(u),
                "horizon",
                30,
                "asOf",
                LocalDate.now(),
                "recurring",
                Map.of()));
    if (!"READY".equals(result.get("status"))) return result;
    var income =
        f.list(Transaction.class, u).stream()
            .filter(
                t ->
                    t.type.equals("INCOME")
                        && t.occurredAt.isAfter(LocalDateTime.now().minusDays(30))
                        && !t.occurredAt.isAfter(LocalDateTime.now()))
            .map(t -> t.amount)
            .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);
    var projected = new java.math.BigDecimal(result.get("total").toString());
    var available = income.subtract(projected).max(java.math.BigDecimal.ZERO);
    var goals = f.list(SavingsGoal.class, u);
    var suggestions =
        goals.stream()
            .map(
                g ->
                    Map.of(
                        "goalId",
                        g.id,
                        "name",
                        g.name,
                        "suggestedContribution",
                        available.divide(
                            java.math.BigDecimal.valueOf(Math.max(goals.size(), 1)),
                            2,
                            java.math.RoundingMode.DOWN),
                        "monthlyTarget",
                        f.goalView(g).get("monthlyPlan")))
            .toList();
    return Map.of(
        "status",
        "READY",
        "modelVersion",
        result.get("modelVersion"),
        "incomeLast30Days",
        income,
        "forecastNext30Days",
        projected,
        "estimatedAvailable",
        available,
        "suggestions",
        suggestions,
        "method",
        "Last 30-day income minus trained model spending forecast, divided equally across goals; no"
            + " automatic transfer");
  }

  @PostMapping("/anomalies/analyze")
  @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
  @SuppressWarnings("unchecked")
  Object analyze(Authentication a) {
    long u = auth.current(a).id;
    f.lockUser(u);
    var result = post("/anomalies", Map.of("transactions", data(u)));
    if ("READY".equals(result.get("status"))) {
      version(result);
      for (var row : (List<Map<String, Object>>) result.get("alerts")) {
        long tid = ((Number) row.get("transactionId")).longValue();
        f.owned(Transaction.class, tid, u);
        var exists =
            em.createQuery(
                    "select count(a) from Alert a where a.userId=:u and a.transactionId=:t",
                    Long.class)
                .setParameter("u", u)
                .setParameter("t", tid)
                .getSingleResult();
        if (exists == 0) {
          var alert = new Alert();
          alert.userId = u;
          alert.transactionId = tid;
          alert.score = ((Number) row.get("score")).doubleValue();
          alert.severity = (String) row.get("severity");
          alert.reason = (String) row.get("reason");
          alert.status = "OPEN";
          alert.modelVersion = (String) result.get("modelVersion");
          em.persist(alert);
          f.notify(
              u,
              "anomaly:" + tid,
              "Giao dịch cần kiểm tra: " + f.owned(Transaction.class, tid, u).description);
        }
      }
    }
    return result;
  }

  @GetMapping("/anomalies")
  Object alerts(Authentication a) {
    long u = auth.current(a).id;
    return f.list(Alert.class, u).stream()
        .map(r -> Map.of("alert", r, "transaction", f.owned(Transaction.class, r.transactionId, u)))
        .toList();
  }

  public record Review(@NotBlank @Pattern(regexp = "VALID|REVIEWED") String status) {}

  @PatchMapping("/anomalies/{id}")
  @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
  Object review(Authentication a, @PathVariable long id, @Valid @RequestBody Review p) {
    long u = auth.current(a).id;
    f.lockUser(u);
    var alert = f.owned(Alert.class, id, u);
    alert.status = p.status();
    f.audit(u, "AI_REVIEW", "alert", id);
    return alert;
  }

  public record Classify(@NotBlank @Size(max = 250) String text) {}

  public record FeedbackInput(
      @NotBlank @Size(max = 250) String description, @NotNull Long categoryId) {}

  @PostMapping("/classify")
  Object classify(@Valid @RequestBody Classify p) {
    return post("/classify", p);
  }

  @PostMapping("/classification-feedback")
  @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
  Object feedback(Authentication a, @Valid @RequestBody FeedbackInput p) {
    long u = auth.current(a).id;
    f.owned(Category.class, p.categoryId(), u);
    var r = new Feedback();
    r.userId = u;
    r.description = p.description();
    r.categoryId = p.categoryId();
    em.persist(r);
    return Map.of(
        "status",
        "saved",
        "message",
        "Phản hồi lưu để dùng khi huấn luyện lại; không tự huấn luyện trong API.");
  }
}
