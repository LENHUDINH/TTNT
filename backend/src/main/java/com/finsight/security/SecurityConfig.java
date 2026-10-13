package com.finsight.security;

import com.finsight.model.UserRepository;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.security.authentication.*;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.cors.*;

@Configuration
public class SecurityConfig {
  @Bean
  PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(12);
  }

  @Bean
  UserDetailsService users(UserRepository r) {
    return email ->
        r.findByEmail(email.toLowerCase())
            .map(u -> User.withUsername(u.email).password(u.passwordHash).roles("USER").build())
            .orElseThrow(() -> new UsernameNotFoundException("Tài khoản không tồn tại"));
  }

  @Bean
  AuthenticationManager manager(UserDetailsService u, PasswordEncoder p) {
    var a = new DaoAuthenticationProvider(u);
    a.setPasswordEncoder(p);
    return new ProviderManager(a);
  }

  @Bean
  SecurityContextRepository contextRepository() {
    return new HttpSessionSecurityContextRepository();
  }

  @Bean
  SecurityFilterChain filter(
      HttpSecurity h,
      SecurityContextRepository r,
      @Value("${finsight.frontend-origin}") String origin)
      throws Exception {
    var c = new CorsConfiguration();
    c.setAllowedOrigins(List.of(origin));
    c.setAllowCredentials(true);
    c.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
    c.setAllowedHeaders(List.of("Content-Type", "X-CSRF-TOKEN", "Idempotency-Key"));
    var s = new UrlBasedCorsConfigurationSource();
    s.registerCorsConfiguration("/**", c);
    return h.cors(x -> x.configurationSource(s))
        .csrf(x -> {})
        .securityContext(x -> x.securityContextRepository(r))
        .authorizeHttpRequests(
            x ->
                x.requestMatchers(
                        "/api/health",
                        "/api/auth/csrf",
                        "/api/auth/login",
                        "/api/auth/register",
                        "/api/auth/forgot",
                        "/api/auth/reset")
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .exceptionHandling(
            x ->
                x.authenticationEntryPoint(
                        (req, res, e) -> {
                          res.setStatus(401);
                          res.setCharacterEncoding("UTF-8");
                          res.setContentType("application/json");
                          res.getWriter().write("{\"message\":\"Vui lòng đăng nhập\"}");
                        })
                    .accessDeniedHandler(
                        (req, res, e) -> {
                          res.setStatus(403);
                          res.setCharacterEncoding("UTF-8");
                          res.setContentType("application/json");
                          res.getWriter()
                              .write("{\"message\":\"Không có quyền hoặc CSRF không hợp lệ\"}");
                        }))
        .logout(
            x ->
                x.logoutUrl("/api/auth/logout")
                    .invalidateHttpSession(true)
                    .deleteCookies("JSESSIONID")
                    .logoutSuccessHandler((req, res, a) -> res.setStatus(204)))
        .addFilterBefore(new RateLimitFilter(), UsernamePasswordAuthenticationFilter.class)
        .build();
  }
}
