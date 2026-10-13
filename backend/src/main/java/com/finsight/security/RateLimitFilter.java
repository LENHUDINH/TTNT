package com.finsight.security;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.web.filter.OncePerRequestFilter;

public class RateLimitFilter extends OncePerRequestFilter {
  record Bucket(long minute, AtomicInteger count) {}

  private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();

  protected void doFilterInternal(
      HttpServletRequest req, HttpServletResponse res, FilterChain chain)
      throws ServletException, IOException {
    if (req.getMethod().equals("POST") && req.getRequestURI().startsWith("/api/auth/")) {
      long m = System.currentTimeMillis() / 60000;
      if (buckets.size() > 10000) buckets.entrySet().removeIf(e -> e.getValue().minute() < m);
      var b =
          buckets.compute(
              req.getRemoteAddr(),
              (k, v) -> v == null || v.minute() != m ? new Bucket(m, new AtomicInteger()) : v);
      if (b.count().incrementAndGet() > 20) {
        res.setStatus(429);
        res.setCharacterEncoding("UTF-8");
        res.setHeader("Retry-After", "60");
        res.setContentType("application/json");
        res.getWriter().write("{\"message\":\"Thử lại sau một phút\"}");
        return;
      }
    }
    chain.doFilter(req, res);
  }
}
