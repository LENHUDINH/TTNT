package com.finsight.transaction;

import com.finsight.auth.AuthController;
import com.finsight.model.Entities.*;
import com.finsight.transaction.FinanceRequests.*;
import jakarta.validation.Valid;
import java.time.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class FinanceController {
  private final FinanceService f;
  private final AuthController auth;

  public FinanceController(FinanceService f, AuthController a) {
    this.f = f;
    auth = a;
  }

  private long u(Authentication a) {
    return auth.current(a).id;
  }

  @GetMapping("/wallets")
  Object wallets(Authentication a) {
    return f.list(Wallet.class, u(a));
  }

  @PostMapping("/wallets")
  Object wallet(Authentication a, @Valid @RequestBody WalletInput p) {
    return f.createWallet(u(a), p);
  }

  @PutMapping("/wallets/{id}")
  Object wallet(Authentication a, @PathVariable long id, @Valid @RequestBody WalletInput p) {
    return f.updateWallet(u(a), id, p);
  }

  @DeleteMapping("/wallets/{id}")
  void archive(Authentication a, @PathVariable long id) {
    f.archiveWallet(u(a), id);
  }

  @GetMapping("/categories")
  Object categories(Authentication a) {
    return f.list(Category.class, u(a));
  }

  @PostMapping("/categories")
  Object category(Authentication a, @Valid @RequestBody CategoryInput p) {
    return f.category(u(a), p);
  }

  @GetMapping("/transactions")
  Object transactions(
      Authentication a,
      @RequestParam(required = false) String search,
      @RequestParam(required = false) Long categoryId,
      @RequestParam(required = false) Long walletId,
      @RequestParam(required = false) LocalDate from,
      @RequestParam(required = false) LocalDate to,
      @RequestParam(defaultValue = "dateDesc") String sort,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return f.transactions(u(a), search, categoryId, walletId, from, to, sort, page, size);
  }

  @PostMapping("/transactions")
  Object transaction(
      Authentication a,
      @Valid @RequestBody TransactionInput p,
      @RequestHeader("Idempotency-Key") String k) {
    return f.addTransaction(u(a), p, k);
  }

  @PutMapping("/transactions/{id}")
  Object update(Authentication a, @PathVariable long id, @Valid @RequestBody TransactionInput p) {
    return f.updateTransaction(u(a), id, p);
  }

  @DeleteMapping("/transactions/{id}")
  void remove(Authentication a, @PathVariable long id) {
    f.deleteTransaction(u(a), id);
  }

  @GetMapping("/transfers")
  Object transfers(Authentication a) {
    return f.list(Transfer.class, u(a));
  }

  @PostMapping("/transfers")
  Object transfer(
      Authentication a,
      @Valid @RequestBody TransferInput p,
      @RequestHeader("Idempotency-Key") String k) {
    return f.transfer(u(a), p, k);
  }

  @GetMapping("/budgets")
  Object budgets(Authentication a) {
    return f.list(Budget.class, u(a)).stream().map(f::budgetView).toList();
  }

  @PostMapping("/budgets")
  Object budget(Authentication a, @Valid @RequestBody BudgetInput p) {
    return f.budget(u(a), null, p);
  }

  @PutMapping("/budgets/{id}")
  Object budget(Authentication a, @PathVariable long id, @Valid @RequestBody BudgetInput p) {
    return f.budget(u(a), id, p);
  }

  @DeleteMapping("/budgets/{id}")
  void budget(Authentication a, @PathVariable long id) {
    f.removeBudget(u(a), id);
  }

  @GetMapping("/savings")
  Object goals(Authentication a) {
    return f.list(SavingsGoal.class, u(a)).stream().map(f::goalView).toList();
  }

  @PostMapping("/savings")
  Object goal(Authentication a, @Valid @RequestBody GoalInput p) {
    return f.goal(u(a), null, p);
  }

  @PutMapping("/savings/{id}")
  Object goal(Authentication a, @PathVariable long id, @Valid @RequestBody GoalInput p) {
    return f.goal(u(a), id, p);
  }

  @DeleteMapping("/savings/{id}")
  void goal(Authentication a, @PathVariable long id) {
    f.removeGoal(u(a), id);
  }

  @PostMapping("/savings/{id}/contributions")
  Object contribute(
      Authentication a, @PathVariable long id, @Valid @RequestBody ContributionInput p) {
    return f.contribute(u(a), id, p);
  }

  @GetMapping("/dashboard")
  Object dashboard(Authentication a, @RequestParam(required = false) String month) {
    return f.dashboard(u(a), month == null ? YearMonth.now().toString() : month);
  }

  @GetMapping("/notifications")
  Object notifications(Authentication a) {
    return f.list(Notification.class, u(a));
  }

  @PatchMapping("/notifications/{id}/read")
  void read(Authentication a, @PathVariable long id) {
    f.markRead(u(a), id);
  }

  @PostMapping("/notifications/read-all")
  void readAll(Authentication a) {
    f.readAll(u(a));
  }

  @GetMapping("/recurring")
  Object recurring(Authentication a) {
    return f.list(Recurring.class, u(a));
  }

  @PostMapping("/recurring")
  Object recurring(Authentication a, @Valid @RequestBody RecurringInput p) {
    return f.recurring(u(a), p);
  }

  @DeleteMapping("/recurring/{id}")
  void recurring(Authentication a, @PathVariable long id) {
    f.stopRecurring(u(a), id);
  }
}
