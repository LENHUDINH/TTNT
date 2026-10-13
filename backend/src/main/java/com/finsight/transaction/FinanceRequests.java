package com.finsight.transaction;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.*;

public final class FinanceRequests {
  public record WalletInput(
      @NotBlank @Size(max = 100) String name,
      @NotBlank @Pattern(regexp = "CASH|BANK|EWALLET|SAVINGS") String type,
      @NotNull @DecimalMin("0.00") @Digits(integer = 15, fraction = 2) BigDecimal initialBalance) {}

  public record TransactionInput(
      @NotNull Long walletId,
      @NotNull Long categoryId,
      @NotBlank @Pattern(regexp = "INCOME|EXPENSE") String type,
      @NotNull @DecimalMin("0.01") @Digits(integer = 15, fraction = 2) BigDecimal amount,
      @NotBlank @Size(max = 250) String description,
      @NotNull @PastOrPresent LocalDateTime occurredAt) {}

  public record TransferInput(
      @NotNull Long fromWalletId,
      @NotNull Long toWalletId,
      @NotNull @DecimalMin("0.01") @Digits(integer = 15, fraction = 2) BigDecimal amount,
      @Size(max = 250) String note) {}

  public record BudgetInput(
      @NotNull Long categoryId,
      @NotBlank @Pattern(regexp = "\\d{4}-\\d{2}") String month,
      @NotNull @DecimalMin("0.01") @Digits(integer = 15, fraction = 2) BigDecimal amount) {}

  public record GoalInput(
      @NotBlank @Size(max = 100) String name,
      @NotNull @DecimalMin("0.01") @Digits(integer = 15, fraction = 2) BigDecimal targetAmount,
      @NotNull LocalDate dueDate) {}

  public record ContributionInput(
      @NotNull Long walletId,
      @NotNull @DecimalMin("0.01") @Digits(integer = 15, fraction = 2) BigDecimal amount,
      @Size(max = 250) String note) {}

  public record CategoryInput(@NotBlank @Size(max = 100) String name) {}

  public record RecurringInput(
      @NotNull Long walletId,
      @NotNull Long categoryId,
      @NotBlank @Pattern(regexp = "INCOME|EXPENSE") String type,
      @NotNull @DecimalMin("0.01") @Digits(integer = 15, fraction = 2) BigDecimal amount,
      @NotBlank @Size(max = 250) String description,
      @NotNull LocalDate nextDate,
      @NotNull @Min(1) @Max(366) Integer intervalDays) {}
}
