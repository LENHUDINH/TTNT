package com.finsight.auth;

import jakarta.servlet.http.HttpSession;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

@Component
public class SessionTracker {
  private final Map<Long, Map<String, HttpSession>> sessions = new ConcurrentHashMap<>();

  public static String hash(String text) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  public void forget(String id) {
    sessions.values().forEach(m -> m.remove(hash(id)));
  }

  public void add(long u, HttpSession s) {
    sessions.computeIfAbsent(u, k -> new ConcurrentHashMap<>()).put(hash(s.getId()), s);
  }

  public List<Map<String, Object>> list(long u, String current) {
    var result = new ArrayList<Map<String, Object>>();
    var m = sessions.getOrDefault(u, Map.of());
    m.forEach(
        (k, s) -> {
          try {
            result.add(
                Map.of(
                    "id",
                    k,
                    "createdAt",
                    s.getCreationTime(),
                    "lastAccess",
                    s.getLastAccessedTime(),
                    "current",
                    k.equals(hash(current))));
          } catch (IllegalStateException e) {
            m.remove(k);
          }
        });
    return result;
  }

  public void revoke(long u, String id) {
    var m = sessions.get(u);
    if (m != null) {
      var s = m.remove(id);
      if (s != null)
        try {
          s.invalidate();
        } catch (IllegalStateException ignored) {
        }
    }
  }

  public void revokeAll(long u, String except) {
    var m = sessions.get(u);
    if (m != null)
      for (var id : List.copyOf(m.keySet()))
        if (except == null || !id.equals(hash(except))) revoke(u, id);
  }
}
