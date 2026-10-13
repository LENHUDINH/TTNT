-- Canonical migration: backend/src/main/resources/db/migration/V1__initial_schema.sql
CREATE TABLE users (
  id bigint PRIMARY KEY AUTO_INCREMENT,
  created_at datetime(6) NOT NULL,
  email varchar(254) NOT NULL UNIQUE,
  password_hash varchar(100) NOT NULL,
  name varchar(100) NOT NULL,
  theme varchar(10) NOT NULL DEFAULT 'system'
);

CREATE TABLE wallets (
  id bigint PRIMARY KEY AUTO_INCREMENT,
  created_at datetime(6) NOT NULL,
  user_id bigint NOT NULL,
  name varchar(100) NOT NULL,
  type varchar(20) NOT NULL,
  balance decimal(19,2) NOT NULL,
  archived boolean NOT NULL DEFAULT false,
  CONSTRAINT ck_wallet_balance CHECK(balance>=0),
  INDEX idx_wallets_user(user_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE categories (
  id bigint PRIMARY KEY AUTO_INCREMENT,
  created_at datetime(6) NOT NULL,
  user_id bigint NOT NULL,
  name varchar(100) NOT NULL,
  INDEX idx_categories_user(user_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id,name)
);

CREATE TABLE transactions (
  id bigint PRIMARY KEY AUTO_INCREMENT,
  created_at datetime(6) NOT NULL,
  user_id bigint NOT NULL,
  wallet_id bigint NOT NULL,
  category_id bigint NOT NULL,
  type varchar(10) NOT NULL,
  amount decimal(19,2) NOT NULL,
  description varchar(250) NOT NULL,
  occurred_at datetime(6) NOT NULL,
  idempotency_key varchar(100) NOT NULL,
  recurring_id bigint NULL,
  CONSTRAINT ck_transactions_amount CHECK(amount>0),
  INDEX idx_transactions_user(user_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(wallet_id) REFERENCES wallets(id),
  FOREIGN KEY(category_id) REFERENCES categories(id),
  UNIQUE(user_id,idempotency_key),
  INDEX idx_tx_user_date(user_id,occurred_at),
  CHECK(type IN ('INCOME','EXPENSE'))
);

CREATE TABLE transfers (
  id bigint PRIMARY KEY AUTO_INCREMENT,
  created_at datetime(6) NOT NULL,
  user_id bigint NOT NULL,
  from_wallet_id bigint NOT NULL,
  to_wallet_id bigint NOT NULL,
  amount decimal(19,2) NOT NULL,
  note varchar(250) NOT NULL,
  idempotency_key varchar(100) NOT NULL,
  CONSTRAINT ck_transfers_amount CHECK(amount>0),
  INDEX idx_transfers_user(user_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(from_wallet_id) REFERENCES wallets(id),
  FOREIGN KEY(to_wallet_id) REFERENCES wallets(id),
  UNIQUE(user_id,idempotency_key)
);

CREATE TABLE budgets (
  id bigint PRIMARY KEY AUTO_INCREMENT,
  created_at datetime(6) NOT NULL,
  user_id bigint NOT NULL,
  category_id bigint NOT NULL,
  month varchar(7) NOT NULL,
  amount decimal(19,2) NOT NULL,
  CONSTRAINT ck_budgets_amount CHECK(amount>0),
  INDEX idx_budgets_user(user_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(category_id) REFERENCES categories(id),
  UNIQUE(user_id,category_id,month)
);

CREATE TABLE savings_goals (
  id bigint PRIMARY KEY AUTO_INCREMENT,
  created_at datetime(6) NOT NULL,
  user_id bigint NOT NULL,
  name varchar(100) NOT NULL,
  target_amount decimal(19,2) NOT NULL,
  due_date date NOT NULL,
  CHECK(target_amount>0),
  INDEX idx_savings_goals_user(user_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE savings_contributions (
  id bigint PRIMARY KEY AUTO_INCREMENT,
  created_at datetime(6) NOT NULL,
  user_id bigint NOT NULL,
  goal_id bigint NOT NULL,
  wallet_id bigint NOT NULL,
  amount decimal(19,2) NOT NULL,
  note varchar(250) NOT NULL,
  CONSTRAINT ck_savings_contributions_amount CHECK(amount>0),
  INDEX idx_savings_contributions_user(user_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(wallet_id) REFERENCES wallets(id),
  FOREIGN KEY(goal_id) REFERENCES savings_goals(id)
);

CREATE TABLE ai_predictions (
  id bigint PRIMARY KEY AUTO_INCREMENT,
  created_at datetime(6) NOT NULL,
  user_id bigint NOT NULL,
  model_version varchar(100) NOT NULL,
  payload longtext NOT NULL,
  stale boolean NOT NULL DEFAULT false,
  INDEX idx_ai_predictions_user(user_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE anomaly_alerts (
  id bigint PRIMARY KEY AUTO_INCREMENT,
  created_at datetime(6) NOT NULL,
  user_id bigint NOT NULL,
  transaction_id bigint NOT NULL,
  score double NOT NULL,
  severity varchar(20) NOT NULL,
  reason varchar(500) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'OPEN',
  model_version varchar(100) NOT NULL,
  INDEX idx_anomaly_alerts_user(user_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(transaction_id) REFERENCES transactions(id),
  UNIQUE(user_id,transaction_id)
);

CREATE TABLE model_versions (
  id bigint PRIMARY KEY AUTO_INCREMENT,
  created_at datetime(6) NOT NULL,
  version varchar(100) NOT NULL UNIQUE,
  metadata longtext NOT NULL
);

CREATE TABLE notifications (
  id bigint PRIMARY KEY AUTO_INCREMENT,
  created_at datetime(6) NOT NULL,
  user_id bigint NOT NULL,
  dedup_key varchar(160) NOT NULL,
  message varchar(500) NOT NULL,
  read_flag boolean NOT NULL DEFAULT false,
  INDEX idx_notifications_user(user_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id,dedup_key)
);

CREATE TABLE audit_logs (
  id bigint PRIMARY KEY AUTO_INCREMENT,
  created_at datetime(6) NOT NULL,
  user_id bigint NOT NULL,
  action varchar(80) NOT NULL,
  entity_type varchar(40) NOT NULL,
  entity_id bigint NULL,
  INDEX idx_audit_logs_user(user_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE recurring_transactions (
  id bigint PRIMARY KEY AUTO_INCREMENT,
  created_at datetime(6) NOT NULL,
  user_id bigint NOT NULL,
  wallet_id bigint NOT NULL,
  category_id bigint NOT NULL,
  type varchar(10) NOT NULL,
  amount decimal(19,2) NOT NULL,
  description varchar(250) NOT NULL,
  next_date date NOT NULL,
  interval_days integer NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  CONSTRAINT ck_recurring_transactions_amount CHECK(amount>0),
  INDEX idx_recurring_transactions_user(user_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(wallet_id) REFERENCES wallets(id),
  FOREIGN KEY(category_id) REFERENCES categories(id)
);

CREATE TABLE password_resets (
  id bigint PRIMARY KEY AUTO_INCREMENT,
  created_at datetime(6) NOT NULL,
  user_id bigint NOT NULL,
  token_hash varchar(64) NOT NULL UNIQUE,
  expires_at datetime(6) NOT NULL,
  used boolean NOT NULL DEFAULT false,
  INDEX idx_password_resets_user(user_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE classification_feedback (
  id bigint PRIMARY KEY AUTO_INCREMENT,
  created_at datetime(6) NOT NULL,
  user_id bigint NOT NULL,
  description varchar(250) NOT NULL,
  category_id bigint NOT NULL,
  INDEX idx_classification_feedback_user(user_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(category_id) REFERENCES categories(id)
);