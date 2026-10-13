package com.finsight.auth;

import com.finsight.model.*;
import com.finsight.model.Entities.*;
import jakarta.persistence.*;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.security.SecureRandom;
import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.*;
import org.springframework.security.core.*;
import org.springframework.security.core.context.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final UserRepository users;
  private final PasswordEncoder encoder;
  private final AuthenticationManager auth;
  private final SecurityContextRepository contexts;
  private final SessionTracker sessions;
  private final EntityManager em;
  private final org.springframework.beans.factory.ObjectProvider<
          org.springframework.mail.javamail.JavaMailSender>
      mail;

  @Value("${spring.mail.host:}")
  String mailHost;

  @Value("${MAIL_FROM:noreply@finsight.local}")
  String mailFrom;

  @Value("${finsight.frontend-origin}")
  String frontend;

  @Value("${finsight.demo-enabled}")
  boolean demo;

  @Value("${finsight.reset-token-log}")
  boolean logToken;

  public AuthController(
      UserRepository u,
      PasswordEncoder p,
      AuthenticationManager a,
      SecurityContextRepository c,
      SessionTracker s,
      EntityManager e,
      org.springframework.beans.factory.ObjectProvider<
              org.springframework.mail.javamail.JavaMailSender>
          m) {
    users = u;
    encoder = p;
    auth = a;
    contexts = c;
    sessions = s;
    em = e;
    mail = m;
  }

  public record Registration(
      @Email @NotBlank @Size(max = 254) String email,
      @NotBlank @Size(min = 10, max = 72) String password,
      @NotBlank @Size(max = 100) String name) {}

  public record Login(@Email @NotBlank String email, @NotBlank @Size(max = 72) String password) {}

  public record Profile(
      @NotBlank @Size(max = 100) String name,
      @NotBlank @Pattern(regexp = "light|dark|system") String theme) {}

  public record Password(
      @NotBlank String currentPassword, @NotBlank @Size(min = 10, max = 72) String newPassword) {}

  public record Forgot(@Email @NotBlank String email) {}

  public record Reset(
      @NotBlank String token, @NotBlank @Size(min = 10, max = 72) String password) {}

  public User current(Authentication a) {
    return users
        .findByEmail(a.getName())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
  }

  private User locked(Authentication a) {
    var u = current(a);
    em.refresh(u, LockModeType.PESSIMISTIC_WRITE);
    return u;
  }

  @GetMapping("/csrf")
  public Map<String, String> csrf(CsrfToken t) {
    return Map.of("token", t.getToken(), "headerName", t.getHeaderName());
  }

  @GetMapping("/me")
  public User me(Authentication a) {
    return current(a);
  }

  @PostMapping("/register")
  @Transactional
  public User register(@Valid @RequestBody Registration r) {
    if (users.findByEmail(r.email().toLowerCase().trim()).isPresent())
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Email đã được sử dụng");
    var u = new User();
    u.email = r.email().toLowerCase().trim();
    u.name = r.name().trim();
    u.passwordHash = encoder.encode(r.password());
    u.theme = "system";
    users.saveAndFlush(u);
    for (String n :
        List.of(
            "Ăn uống",
            "Mua sắm",
            "Đi lại",
            "Học tập",
            "Giải trí",
            "Nhà ở",
            "Hóa đơn",
            "Sức khỏe",
            "Thu nhập",
            "Khác")) {
      var c = new Category();
      c.userId = u.id;
      c.name = n;
      em.persist(c);
    }
    return u;
  }

  @PostMapping("/login")
  @Transactional
  public User login(@Valid @RequestBody Login r, HttpServletRequest req, HttpServletResponse res) {
    users
        .findByEmail(r.email().toLowerCase().trim())
        .ifPresent(u -> em.refresh(u, LockModeType.PESSIMISTIC_WRITE));
    Authentication a;
    try {
      a =
          auth.authenticate(
              new UsernamePasswordAuthenticationToken(
                  r.email().toLowerCase().trim(), r.password()));
    } catch (AuthenticationException e) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email hoặc mật khẩu không đúng");
    }
    sessions.forget(req.getSession().getId());
    req.changeSessionId();
    new org.springframework.security.web.csrf.CsrfAuthenticationStrategy(
            new org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository())
        .onAuthentication(a, req, res);
    var c = SecurityContextHolder.createEmptyContext();
    c.setAuthentication(a);
    SecurityContextHolder.setContext(c);
    contexts.saveContext(c, req, res);
    var u = current(a);
    sessions.add(u.id, req.getSession());
    return u;
  }

  @PutMapping("/profile")
  @Transactional
  public User profile(Authentication a, @Valid @RequestBody Profile p) {
    var u = locked(a);
    u.name = p.name().trim();
    u.theme = p.theme();
    return users.save(u);
  }

  @PostMapping("/password")
  @Transactional
  public Map<String, String> password(
      Authentication a, @Valid @RequestBody Password p, HttpServletRequest req) {
    var u = locked(a);
    if (!encoder.matches(p.currentPassword(), u.passwordHash))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mật khẩu hiện tại không đúng");
    u.passwordHash = encoder.encode(p.newPassword());
    users.save(u);
    em.createQuery("update PasswordReset set used=true where userId=:u")
        .setParameter("u", u.id)
        .executeUpdate();
    sessions.revokeAll(u.id, req.getSession().getId());
    return Map.of("status", "updated");
  }

  @GetMapping("/sessions")
  public Object listSessions(Authentication a, HttpServletRequest r) {
    return sessions.list(current(a).id, r.getSession().getId());
  }

  @DeleteMapping("/sessions/{id}")
  public void revoke(Authentication a, @PathVariable String id) {
    sessions.revoke(current(a).id, id);
  }

  @DeleteMapping("/account")
  @Transactional
  public void delete(Authentication a, @RequestBody Login p) {
    var u = locked(a);
    if (!encoder.matches(p.password(), u.passwordHash))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mật khẩu không đúng");
    for (String table :
        List.of(
            "chat_feedback",
            "chat_messages",
            "chat_conversations",
            "chat_preferences",
            "anomaly_alerts",
            "classification_feedback",
            "savings_contributions",
            "ai_predictions",
            "notifications",
            "audit_logs",
            "password_resets",
            "transfers",
            "transactions",
            "recurring_transactions",
            "budgets",
            "savings_goals",
            "categories",
            "wallets"))
      em.createNativeQuery("DELETE FROM " + table + " WHERE user_id=:u")
          .setParameter("u", u.id)
          .executeUpdate();
    users.delete(u);
    sessions.revokeAll(u.id, null);
  }

  @PostMapping("/forgot")
  @Transactional
  public Object forgot(@Valid @RequestBody Forgot p) {
    if (mailHost.isBlank() && !(demo && logToken))
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE, "Dịch vụ gửi email khôi phục chưa được cấu hình");
    users
        .findByEmail(p.email().toLowerCase().trim())
        .ifPresent(
            u -> {
              byte[] b = new byte[32];
              new SecureRandom().nextBytes(b);
              String token = Base64.getUrlEncoder().withoutPadding().encodeToString(b);
              var r = new PasswordReset();
              r.userId = u.id;
              r.tokenHash = SessionTracker.hash(token);
              r.expiresAt = LocalDateTime.now().plusMinutes(15);
              em.persist(r);
              if (!mailHost.isBlank()) {
                var msg = new org.springframework.mail.SimpleMailMessage();
                msg.setFrom(mailFrom);
                msg.setTo(u.email);
                msg.setSubject("FinSight AI — Khôi phục mật khẩu");
                msg.setText(
                    "Mã khôi phục: " + token + "\nHết hạn sau 15 phút.\n" + frontend + "/reset");
                try {
                  mail.getObject().send(msg);
                } catch (Exception e) {
                  throw new ResponseStatusException(
                      HttpStatus.SERVICE_UNAVAILABLE,
                      "Không thể gửi email khôi phục; vui lòng thử lại sau");
                }
              } else
                org.slf4j.LoggerFactory.getLogger(AuthController.class)
                    .info("DEMO ONLY password reset for {}: {}", u.email, token);
            });
    return Map.of("message", "Nếu email tồn tại, yêu cầu khôi phục đã được tiếp nhận.");
  }

  @PostMapping("/reset")
  @Transactional
  public Object reset(@Valid @RequestBody Reset p) {
    var rows =
        em.createQuery("from PasswordReset where tokenHash=:h", PasswordReset.class)
            .setParameter("h", SessionTracker.hash(p.token()))
            .getResultList();
    if (!rows.isEmpty()) {
      em.find(User.class, rows.getFirst().userId, LockModeType.PESSIMISTIC_WRITE);
      em.refresh(rows.getFirst(), LockModeType.PESSIMISTIC_WRITE);
    }
    if (rows.isEmpty()
        || rows.getFirst().used
        || rows.getFirst().expiresAt.isBefore(LocalDateTime.now()))
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Mã khôi phục không hợp lệ hoặc hết hạn");
    var r = rows.getFirst();
    r.used = true;
    em.createQuery("update PasswordReset set used=true where userId=:u")
        .setParameter("u", r.userId)
        .executeUpdate();
    var u = users.findById(r.userId).orElseThrow();
    u.passwordHash = encoder.encode(p.password());
    sessions.revokeAll(u.id, null);
    return Map.of("status", "updated");
  }
}
