package com.finsight.chat;

import com.finsight.model.Entities.Base;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

public final class ChatEntities {
  private ChatEntities() {}

  @Entity(name = "ChatConversation")
  @Table(name = "chat_conversations")
  public static class ChatConversation extends Base {
    @Column(nullable = false)
    public Long userId;

    @Column(nullable = false, length = 100)
    public String title;
  }

  @Entity(name = "ChatMessage")
  @Table(name = "chat_messages")
  public static class ChatMessage extends Base {
    @Column(nullable = false)
    public Long userId;

    @Column(nullable = false)
    public Long conversationId;

    @Column(nullable = false, length = 12)
    public String role;

    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(nullable = false, columnDefinition = "longtext")
    public String content;

    @Column(nullable = false, length = 12)
    public String status;

    @Column(nullable = false, length = 100)
    public String clientMessageId;

    @Column(length = 100)
    public String modelVersion;

    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(nullable = false, columnDefinition = "longtext")
    public String metadata;

    @Column(length = 36)
    public String attemptToken;
  }

  @Entity(name = "ChatFeedback")
  @Table(name = "chat_feedback")
  public static class ChatFeedback extends Base {
    @Column(nullable = false)
    public Long userId;

    @Column(nullable = false)
    public Long messageId;

    @Column(nullable = false)
    public Integer rating;

    @Column(nullable = false, length = 1000)
    public String comment;
  }

  @Entity(name = "ChatPreference")
  @Table(name = "chat_preferences")
  public static class ChatPreference extends Base {
    @Column(nullable = false)
    public Long userId;

    @Column(nullable = false)
    public boolean externalConsent;
  }
}
