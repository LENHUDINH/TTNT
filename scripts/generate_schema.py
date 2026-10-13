from pathlib import Path
# V1 historical source generator: do not rerun against a migrated working tree. V2 adds updated_at separately.
# Source generator retained for reproducibility; entities use explicit columns and DB foreign keys.
models={
'User':('users', [('email','String','varchar(254) NOT NULL UNIQUE'),('passwordHash','String','varchar(100) NOT NULL'),('name','String','varchar(100) NOT NULL'),('theme','String',"varchar(10) NOT NULL DEFAULT 'system'")]),
'Wallet':('wallets',[('userId','Long','bigint NOT NULL'),('name','String','varchar(100) NOT NULL'),('type','String','varchar(20) NOT NULL'),('balance','BigDecimal','decimal(19,2) NOT NULL'),('archived','boolean','boolean NOT NULL DEFAULT false')]),
'Category':('categories',[('userId','Long','bigint NOT NULL'),('name','String','varchar(100) NOT NULL')]),
'Transaction':('transactions',[('userId','Long','bigint NOT NULL'),('walletId','Long','bigint NOT NULL'),('categoryId','Long','bigint NOT NULL'),('type','String','varchar(10) NOT NULL'),('amount','BigDecimal','decimal(19,2) NOT NULL'),('description','String','varchar(250) NOT NULL'),('occurredAt','LocalDateTime','datetime(6) NOT NULL'),('idempotencyKey','String','varchar(100) NOT NULL'),('recurringId','Long','bigint NULL')]),
'Transfer':('transfers',[('userId','Long','bigint NOT NULL'),('fromWalletId','Long','bigint NOT NULL'),('toWalletId','Long','bigint NOT NULL'),('amount','BigDecimal','decimal(19,2) NOT NULL'),('note','String','varchar(250) NOT NULL'),('idempotencyKey','String','varchar(100) NOT NULL')]),
'Budget':('budgets',[('userId','Long','bigint NOT NULL'),('categoryId','Long','bigint NOT NULL'),('month','String','varchar(7) NOT NULL'),('amount','BigDecimal','decimal(19,2) NOT NULL')]),
'SavingsGoal':('savings_goals',[('userId','Long','bigint NOT NULL'),('name','String','varchar(100) NOT NULL'),('targetAmount','BigDecimal','decimal(19,2) NOT NULL'),('dueDate','LocalDate','date NOT NULL')]),
'Contribution':('savings_contributions',[('userId','Long','bigint NOT NULL'),('goalId','Long','bigint NOT NULL'),('walletId','Long','bigint NOT NULL'),('amount','BigDecimal','decimal(19,2) NOT NULL'),('note','String','varchar(250) NOT NULL')]),
'Prediction':('ai_predictions',[('userId','Long','bigint NOT NULL'),('modelVersion','String','varchar(100) NOT NULL'),('payload','String','longtext NOT NULL'),('stale','boolean','boolean NOT NULL DEFAULT false')]),
'Alert':('anomaly_alerts',[('userId','Long','bigint NOT NULL'),('transactionId','Long','bigint NOT NULL'),('score','Double','double NOT NULL'),('severity','String','varchar(20) NOT NULL'),('reason','String','varchar(500) NOT NULL'),('status','String',"varchar(20) NOT NULL DEFAULT 'OPEN'"),('modelVersion','String','varchar(100) NOT NULL')]),
'ModelVersion':('model_versions',[('version','String','varchar(100) NOT NULL UNIQUE'),('metadata','String','longtext NOT NULL')]),
'Notification':('notifications',[('userId','Long','bigint NOT NULL'),('dedupKey','String','varchar(160) NOT NULL'),('message','String','varchar(500) NOT NULL'),('readFlag','boolean','boolean NOT NULL DEFAULT false')]),
'AuditLog':('audit_logs',[('userId','Long','bigint NOT NULL'),('action','String','varchar(80) NOT NULL'),('entityType','String','varchar(40) NOT NULL'),('entityId','Long','bigint NULL')]),
'Recurring':('recurring_transactions',[('userId','Long','bigint NOT NULL'),('walletId','Long','bigint NOT NULL'),('categoryId','Long','bigint NOT NULL'),('type','String','varchar(10) NOT NULL'),('amount','BigDecimal','decimal(19,2) NOT NULL'),('description','String','varchar(250) NOT NULL'),('nextDate','LocalDate','date NOT NULL'),('intervalDays','Integer','integer NOT NULL'),('enabled','boolean','boolean NOT NULL DEFAULT true')]),
'PasswordReset':('password_resets',[('userId','Long','bigint NOT NULL'),('tokenHash','String','varchar(64) NOT NULL UNIQUE'),('expiresAt','LocalDateTime','datetime(6) NOT NULL'),('used','boolean','boolean NOT NULL DEFAULT false')]),
'Feedback':('classification_feedback',[('userId','Long','bigint NOT NULL'),('description','String','varchar(250) NOT NULL'),('categoryId','Long','bigint NOT NULL')]),
}
def snake(v):
 import re
 return re.sub(r'(?<!^)(?=[A-Z])','_',v).lower()
java=['package com.finsight.model;','import jakarta.persistence.*;','import com.fasterxml.jackson.annotation.JsonIgnore;','import java.math.BigDecimal;','import java.time.*;','public final class Entities {', '@MappedSuperclass public static abstract class Base { @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id; @Column(nullable=false) public LocalDateTime createdAt; @PrePersist public void timestamp(){createdAt=LocalDateTime.now();} }']
sql=[]
for name,(table,fields) in models.items():
 java.append(f'@Entity(name="{name}") @Table(name="{table}") public static class {name} extends Base {{')
 cols=['id bigint PRIMARY KEY AUTO_INCREMENT', 'created_at datetime(6) NOT NULL']
 for field,typ,decl in fields:
  annotation='@JsonIgnore ' if field in ['passwordHash','tokenHash'] else ''
  opts=f'name="{snake(field)}"'
  if 'NOT NULL' in decl: opts+=', nullable=false'
  if typ=='BigDecimal': opts+=', precision=19, scale=2'
  if decl.startswith('varchar'): opts+=', length='+decl.split('(')[1].split(')')[0]
  if 'longtext' in decl: annotation+='@org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.LONGVARCHAR) '; opts+=', columnDefinition="longtext"'
  java.append(f'{annotation}@Column({opts}) public {typ} {field};')
  cols.append(snake(field)+' '+decl)
 if name=='Wallet': cols.append('CONSTRAINT ck_wallet_balance CHECK(balance>=0)')
 if name in ['Transaction','Transfer','Budget','Contribution','Recurring']: cols.append('CONSTRAINT ck_'+table+'_amount CHECK(amount>0)')
 if name=='SavingsGoal': cols.append('CHECK(target_amount>0)')
 if any(f[0]=='userId' for f in fields):
  cols+=['INDEX idx_'+table+'_user(user_id)', 'FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE']
 for field,other in [('walletId','wallets'),('categoryId','categories'),('goalId','savings_goals'),('fromWalletId','wallets'),('toWalletId','wallets'),('transactionId','transactions')]:
  if any(f[0]==field for f in fields): cols.append(f'FOREIGN KEY({snake(field)}) REFERENCES {other}(id)')
 if name in ['Transaction','Transfer']: cols.append('UNIQUE(user_id,idempotency_key)')
 if name=='Budget': cols.append('UNIQUE(user_id,category_id,month)')
 if name=='Category': cols.append('UNIQUE(user_id,name)')
 if name=='Alert': cols.append('UNIQUE(user_id,transaction_id)')
 if name=='Notification': cols.append('UNIQUE(user_id,dedup_key)')
 if name=='Transaction': cols+=['INDEX idx_tx_user_date(user_id,occurred_at)',"CHECK(type IN ('INCOME','EXPENSE'))"]
 java.append('}')
 sql.append('CREATE TABLE '+table+' (\n  '+',\n  '.join(cols)+'\n);')
java.append('}')
Path('backend/src/main/java/com/finsight/model/Entities.java').write_text('\n'.join(java))
Path('backend/src/main/resources/db/migration/V1__initial_schema.sql').write_text('\n\n'.join(sql))
Path('database/schema.sql').write_text('-- Canonical migration: backend/src/main/resources/db/migration/V1__initial_schema.sql\n'+'\n\n'.join(sql))
