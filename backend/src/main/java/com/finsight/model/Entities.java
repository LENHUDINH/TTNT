package com.finsight.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;

public final class Entities {
  @MappedSuperclass
  public abstract static class Base {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false)
    public LocalDateTime createdAt;

    @Column(nullable = false)
    public LocalDateTime updatedAt;

    @PreUpdate
    public void updated() {
      updatedAt = LocalDateTime.now();
    }

    @PrePersist
    public void timestamp() {
      createdAt = LocalDateTime.now();
      updatedAt = createdAt;
    }
  }

  @Entity(name = "User")
  @Table(name = "users")
  public static class User extends Base {
    @Column(name = "email", nullable = false, length = 254)
    public String email;

    @JsonIgnore
    @Column(name = "password_hash", nullable = false, length = 100)
    public String passwordHash;

    @Column(name = "name", nullable = false, length = 100)
    public String name;

    @Column(name = "theme", nullable = false, length = 10)
    public String theme;
  }

  @Entity(name = "Wallet")
  @Table(name = "wallets")
  public static class Wallet extends Base {
    @Column(name = "user_id", nullable = false)
    public Long userId;

    @Column(name = "name", nullable = false, length = 100)
    public String name;

    @Column(name = "type", nullable = false, length = 20)
    public String type;

    @Column(name = "balance", nullable = false, precision = 19, scale = 2)
    public BigDecimal balance;

    @Column(name = "archived", nullable = false)
    public boolean archived;
  }

  @Entity(name = "Category")
  @Table(name = "categories")
  public static class Category extends Base {
    @Column(name = "user_id", nullable = false)
    public Long userId;

    @Column(name = "name", nullable = false, length = 100)
    public String name;
  }

  @Entity(name = "Transaction")
  @Table(name = "transactions")
  public static class Transaction extends Base {
    @Column(name = "user_id", nullable = false)
    public Long userId;

    @Column(name = "wallet_id", nullable = false)
    public Long walletId;

    @Column(name = "category_id", nullable = false)
    public Long categoryId;

    @Column(name = "type", nullable = false, length = 10)
    public String type;

    @Column(name = "amount", nullable = false, precision = 19, scale = 2)
    public BigDecimal amount;

    @Column(name = "description", nullable = false, length = 250)
    public String description;

    @Column(name = "occurred_at", nullable = false)
    public LocalDateTime occurredAt;

    @Column(name = "idempotency_key", nullable = false, length = 100)
    public String idempotencyKey;

    @Column(name = "recurring_id")
    public Long recurringId;
  }

  @Entity(name = "Transfer")
  @Table(name = "transfers")
  public static class Transfer extends Base {
    @Column(name = "user_id", nullable = false)
    public Long userId;

    @Column(name = "from_wallet_id", nullable = false)
    public Long fromWalletId;

    @Column(name = "to_wallet_id", nullable = false)
    public Long toWalletId;

    @Column(name = "amount", nullable = false, precision = 19, scale = 2)
    public BigDecimal amount;

    @Column(name = "note", nullable = false, length = 250)
    public String note;

    @Column(name = "idempotency_key", nullable = false, length = 100)
    public String idempotencyKey;
  }

  @Entity(name = "Budget")
  @Table(name = "budgets")
  public static class Budget extends Base {
    @Column(name = "user_id", nullable = false)
    public Long userId;

    @Column(name = "category_id", nullable = false)
    public Long categoryId;

    @Column(name = "month", nullable = false, length = 7)
    public String month;

    @Column(name = "amount", nullable = false, precision = 19, scale = 2)
    public BigDecimal amount;
  }

  @Entity(name = "SavingsGoal")
  @Table(name = "savings_goals")
  public static class SavingsGoal extends Base {
    @Column(name = "user_id", nullable = false)
    public Long userId;

    @Column(name = "name", nullable = false, length = 100)
    public String name;

    @Column(name = "target_amount", nullable = false, precision = 19, scale = 2)
    public BigDecimal targetAmount;

    @Column(name = "due_date", nullable = false)
    public LocalDate dueDate;
  }

  @Entity(name = "Contribution")
  @Table(name = "savings_contributions")
  public static class Contribution extends Base {
    @Column(name = "user_id", nullable = false)
    public Long userId;

    @Column(name = "goal_id", nullable = false)
    public Long goalId;

    @Column(name = "wallet_id", nullable = false)
    public Long walletId;

    @Column(name = "amount", nullable = false, precision = 19, scale = 2)
    public BigDecimal amount;

    @Column(name = "note", nullable = false, length = 250)
    public String note;
  }

  @Entity(name = "Prediction")
  @Table(name = "ai_predictions")
  public static class Prediction extends Base {
    @Column(name = "user_id", nullable = false)
    public Long userId;

    @Column(name = "model_version", nullable = false, length = 100)
    public String modelVersion;

    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.LONGVARCHAR)
    @Column(name = "payload", nullable = false, columnDefinition = "longtext")
    public String payload;

    @Column(name = "stale", nullable = false)
    public boolean stale;
  }

  @Entity(name = "Alert")
  @Table(name = "anomaly_alerts")
  public static class Alert extends Base {
    @Column(name = "user_id", nullable = false)
    public Long userId;

    @Column(name = "transaction_id", nullable = false)
    public Long transactionId;

    @Column(name = "score", nullable = false)
    public Double score;

    @Column(name = "severity", nullable = false, length = 20)
    public String severity;

    @Column(name = "reason", nullable = false, length = 500)
    public String reason;

    @Column(name = "status", nullable = false, length = 20)
    public String status;

    @Column(name = "model_version", nullable = false, length = 100)
    public String modelVersion;
  }

  @Entity(name = "ModelVersion")
  @Table(name = "model_versions")
  public static class ModelVersion extends Base {
    @Column(name = "version", nullable = false, length = 100)
    public String version;

    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.LONGVARCHAR)
    @Column(name = "metadata", nullable = false, columnDefinition = "longtext")
    public String metadata;
  }

  @Entity(name = "Notification")
  @Table(name = "notifications")
  public static class Notification extends Base {
    @Column(name = "user_id", nullable = false)
    public Long userId;

    @Column(name = "dedup_key", nullable = false, length = 160)
    public String dedupKey;

    @Column(name = "message", nullable = false, length = 500)
    public String message;

    @Column(name = "read_flag", nullable = false)
    public boolean readFlag;
  }

  @Entity(name = "AuditLog")
  @Table(name = "audit_logs")
  public static class AuditLog extends Base {
    @Column(name = "user_id", nullable = false)
    public Long userId;

    @Column(name = "action", nullable = false, length = 80)
    public String action;

    @Column(name = "entity_type", nullable = false, length = 40)
    public String entityType;

    @Column(name = "entity_id")
    public Long entityId;
  }

  @Entity(name = "Recurring")
  @Table(name = "recurring_transactions")
  public static class Recurring extends Base {
    @Column(name = "user_id", nullable = false)
    public Long userId;

    @Column(name = "wallet_id", nullable = false)
    public Long walletId;

    @Column(name = "category_id", nullable = false)
    public Long categoryId;

    @Column(name = "type", nullable = false, length = 10)
    public String type;

    @Column(name = "amount", nullable = false, precision = 19, scale = 2)
    public BigDecimal amount;

    @Column(name = "description", nullable = false, length = 250)
    public String description;

    @Column(name = "next_date", nullable = false)
    public LocalDate nextDate;

    @Column(name = "interval_days", nullable = false)
    public Integer intervalDays;

    @Column(name = "enabled", nullable = false)
    public boolean enabled;
  }

  @Entity(name = "PasswordReset")
  @Table(name = "password_resets")
  public static class PasswordReset extends Base {
    @Column(name = "user_id", nullable = false)
    public Long userId;

    @JsonIgnore
    @Column(name = "token_hash", nullable = false, length = 64)
    public String tokenHash;

    @Column(name = "expires_at", nullable = false)
    public LocalDateTime expiresAt;

    @Column(name = "used", nullable = false)
    public boolean used;
  }

  @Entity(name = "Feedback")
  @Table(name = "classification_feedback")
  public static class Feedback extends Base {
    @Column(name = "user_id", nullable = false)
    public Long userId;

    @Column(name = "description", nullable = false, length = 250)
    public String description;

    @Column(name = "category_id", nullable = false)
    public Long categoryId;
  }
}
