package com.finsight.chat;

import com.finsight.auth.AuthController;
import com.finsight.chat.ChatRequests.*;
import jakarta.validation.Valid;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/chat")
public class ChatController {
  private final AuthController auth;
  private final ChatStore store;
  private final ChatClient client;

  public ChatController(AuthController auth, ChatStore store, ChatClient client) {
    this.auth = auth;
    this.store = store;
    this.client = client;
  }

  private long user(Authentication a) {
    return auth.current(a).id;
  }

  @GetMapping("/status")
  Object status(Authentication a) {
    long u = user(a);
    var status = client.status();
    return Map.of(
        "configured",
        Boolean.TRUE.equals(status.get("configured")),
        "provider",
        Objects.toString(status.get("provider"), "unavailable"),
        "model",
        Objects.toString(status.get("model"), ""),
        "external",
        Boolean.TRUE.equals(status.get("external")),
        "externalConsent",
        store.consent(u),
        "message",
        Objects.toString(status.get("message"), ""));
  }

  @GetMapping("/preferences")
  Object preferences(Authentication a) {
    return Map.of("externalConsent", store.consent(user(a)));
  }

  @PutMapping("/preferences")
  Object preferences(Authentication a, @Valid @RequestBody Preference p) {
    return store.preference(user(a), p);
  }

  @GetMapping("/conversations")
  Object conversations(
      Authentication a,
      @RequestParam(required = false) String search,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return store.conversations(user(a), search, page, size);
  }

  @PostMapping("/conversations")
  @ResponseStatus(HttpStatus.CREATED)
  Object create(Authentication a, @Valid @RequestBody(required = false) Create p) {
    return store.create(user(a), p == null ? new Create(null) : p);
  }

  @PatchMapping("/conversations/{id}")
  Object rename(Authentication a, @PathVariable long id, @Valid @RequestBody Rename p) {
    return store.rename(user(a), id, p);
  }

  @DeleteMapping("/conversations/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void delete(Authentication a, @PathVariable long id) {
    store.delete(user(a), id);
  }

  @GetMapping("/conversations/{id}/messages")
  Object messages(
      Authentication a,
      @PathVariable long id,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "50") int size) {
    return store.messages(user(a), id, page, size);
  }

  @PostMapping("/conversations/{id}/messages")
  Object send(Authentication a, @PathVariable long id, @Valid @RequestBody Send p) {
    long u = user(a);
    var status = client.status();
    var prepared = store.prepare(u, id, p, Boolean.TRUE.equals(status.get("external")));
    if (!prepared.generate()) return prepared.message();
    Map<String, Object> result;
    try {
      result = client.generate(prepared.payload());
      if (!(result.get("content") instanceof String content)
          || content.isBlank()
          || content.length() > 16000
          || !(result.get("modelVersion") instanceof String version)
          || version.isBlank()
          || version.length() > 100) throw new ChatClient.ChatUnavailableException();
    } catch (Exception e) {
      var message = store.finish(prepared, Map.of(), true);
      if ("CANCELLED".equals(message.get("status"))) return message;
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE,
          "Chưa nhận được phản hồi AI. Kiểm tra cấu hình và thử lại với cùng tin nhắn.");
    }
    return store.finish(prepared, result, false);
  }

  @PostMapping("/conversations/{id}/cancel")
  Object cancel(Authentication a, @PathVariable long id, @Valid @RequestBody Cancel p) {
    var cancelled = store.cancel(user(a), id, p);
    client.cancel(cancelled.requestId());
    return cancelled.message();
  }

  @PostMapping("/messages/{id}/feedback")
  Object feedback(Authentication a, @PathVariable long id, @Valid @RequestBody Feedback p) {
    return store.feedback(user(a), id, p);
  }
}
