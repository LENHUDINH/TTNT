package com.finsight.chat;

import jakarta.validation.constraints.*;

public final class ChatRequests {
  private ChatRequests() {}

  public record Create(@Size(max = 100) String title) {}

  public record Rename(@NotBlank @Size(max = 100) String title) {}

  public record Send(
      @NotBlank @Size(max = 2000) String content,
      @NotBlank @Size(max = 100) @Pattern(regexp = "[A-Za-z0-9_.:-]+") String clientMessageId,
      @Pattern(regexp = "[0-9]{4}-[0-9]{2}") String month) {}

  public record Cancel(@NotBlank @Size(max = 100) String clientMessageId) {}

  public record Feedback(
      @NotNull @Min(-1) @Max(1) Integer rating, @Size(max = 1000) String comment) {}

  public record Preference(@NotNull Boolean externalConsent) {}
}
