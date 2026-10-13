package com.finsight.chat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class ChatClient {
  private final RestClient client;
  private final RestClient fastClient;
  private final ObjectMapper json;

  public ChatClient(
      ObjectMapper json,
      @Value("${finsight.ai-url}") String url,
      @Value("${finsight.ai-key}") String key) {
    this.json = json;
    var factory = new SimpleClientHttpRequestFactory();
    factory.setConnectTimeout(2000);
    factory.setReadTimeout(95000);
    client =
        RestClient.builder()
            .baseUrl(url)
            .requestFactory(factory)
            .defaultHeader("X-Service-Key", key)
            .build();
    var fastFactory = new SimpleClientHttpRequestFactory();
    fastFactory.setConnectTimeout(2000);
    fastFactory.setReadTimeout(2000);
    fastClient =
        RestClient.builder()
            .baseUrl(url)
            .requestFactory(fastFactory)
            .defaultHeader("X-Service-Key", key)
            .build();
  }

  @SuppressWarnings("unchecked")
  public Map<String, Object> status() {
    try {
      var result = fastClient.get().uri("/chat/status").retrieve().body(Map.class);
      if (result == null) throw new IllegalStateException("Empty status");
      return result;
    } catch (Exception e) {
      return Map.of(
          "configured",
          false,
          "provider",
          "unavailable",
          "model",
          "",
          "external",
          false,
          "message",
          "Dịch vụ chat AI chưa sẵn sàng. Bạn vẫn có thể quản lý tài chính.");
    }
  }

  @SuppressWarnings("unchecked")
  public Map<String, Object> generate(Object payload) {
    try {
      var result =
          client
              .post()
              .uri("/chat")
              .contentType(MediaType.APPLICATION_JSON)
              .body(json.writeValueAsString(payload))
              .retrieve()
              .body(Map.class);
      if (result == null) throw new IllegalStateException("Empty AI response");
      return result;
    } catch (Exception e) {
      // Never log chat, financial context, keys, provider bodies, or request payloads.
      org.slf4j.LoggerFactory.getLogger(getClass())
          .warn("Chat AI request failed: {}", e.getClass().getSimpleName());
      throw new ChatUnavailableException();
    }
  }

  public static class ChatUnavailableException extends RuntimeException {}

  public void cancel(String requestId) {
    if (requestId == null) return;
    try {
      fastClient
          .post()
          .uri("/chat/cancel")
          .contentType(MediaType.APPLICATION_JSON)
          .body(json.writeValueAsString(Map.of("requestId", requestId)))
          .retrieve()
          .toBodilessEntity();
    } catch (Exception ignored) {
      // Persisted cancellation already prevents late writes, including when the AI is unavailable.
    }
  }
}
