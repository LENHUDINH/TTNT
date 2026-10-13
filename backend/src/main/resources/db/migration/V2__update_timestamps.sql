ALTER TABLE users ADD updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);
UPDATE users SET updated_at=created_at;

ALTER TABLE wallets ADD updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);
UPDATE wallets SET updated_at=created_at;

ALTER TABLE categories ADD updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);
UPDATE categories SET updated_at=created_at;

ALTER TABLE transactions ADD updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);
UPDATE transactions SET updated_at=created_at;

ALTER TABLE transfers ADD updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);
UPDATE transfers SET updated_at=created_at;

ALTER TABLE budgets ADD updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);
UPDATE budgets SET updated_at=created_at;

ALTER TABLE savings_goals ADD updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);
UPDATE savings_goals SET updated_at=created_at;

ALTER TABLE savings_contributions ADD updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);
UPDATE savings_contributions SET updated_at=created_at;

ALTER TABLE ai_predictions ADD updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);
UPDATE ai_predictions SET updated_at=created_at;

ALTER TABLE anomaly_alerts ADD updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);
UPDATE anomaly_alerts SET updated_at=created_at;

ALTER TABLE model_versions ADD updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);
UPDATE model_versions SET updated_at=created_at;

ALTER TABLE notifications ADD updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);
UPDATE notifications SET updated_at=created_at;

ALTER TABLE audit_logs ADD updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);
UPDATE audit_logs SET updated_at=created_at;

ALTER TABLE recurring_transactions ADD updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);
UPDATE recurring_transactions SET updated_at=created_at;

ALTER TABLE password_resets ADD updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);
UPDATE password_resets SET updated_at=created_at;

ALTER TABLE classification_feedback ADD updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);
UPDATE classification_feedback SET updated_at=created_at;
