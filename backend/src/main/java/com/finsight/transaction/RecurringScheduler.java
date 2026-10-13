package com.finsight.transaction;

import jakarta.persistence.EntityManager;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Component
public class RecurringScheduler {
  private final FinanceService f;
  private final EntityManager em;
  private final TransactionTemplate tx;

  public RecurringScheduler(FinanceService f, EntityManager e, PlatformTransactionManager m) {
    this.f = f;
    em = e;
    tx = new TransactionTemplate(m);
  }

  @Scheduled(fixedDelay = 60000, initialDelay = 60000)
  public void run() {
    var ids =
        tx.execute(
            s ->
                em.createQuery(
                        "select id from Recurring where enabled=true and nextDate<=:d", Long.class)
                    .setParameter("d", java.time.LocalDate.now())
                    .getResultList());
    if (ids != null)
      for (long id : ids)
        try {
          f.executeRecurring(id);
        } catch (Exception e) {
          org.slf4j.LoggerFactory.getLogger(getClass()).warn("Recurring {} failed; will retry", id);
        }
  }
}
