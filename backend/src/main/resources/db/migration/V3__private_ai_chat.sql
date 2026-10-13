CREATE TABLE chat_conversations (
  id bigint PRIMARY KEY AUTO_INCREMENT,
  user_id bigint NOT NULL,
  title varchar(100) NOT NULL,
  created_at datetime(6) NOT NULL,
  updated_at datetime(6) NOT NULL,
  UNIQUE(id,user_id),
  INDEX idx_chat_conversations_user_updated(user_id,updated_at,id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE chat_messages (
  id bigint PRIMARY KEY AUTO_INCREMENT,
  user_id bigint NOT NULL,
  conversation_id bigint NOT NULL,
  role varchar(12) NOT NULL,
  content longtext NOT NULL,
  status varchar(12) NOT NULL,
  client_message_id varchar(100) NOT NULL,
  model_version varchar(100) NULL,
  metadata longtext NOT NULL,
  attempt_token varchar(36) NULL,
  created_at datetime(6) NOT NULL,
  updated_at datetime(6) NOT NULL,
  UNIQUE(id,user_id),
  UNIQUE(user_id,conversation_id,client_message_id,role),
  INDEX idx_chat_messages_conversation(conversation_id,user_id,id),
  INDEX idx_chat_messages_pending(user_id,status,updated_at),
  CHECK(role IN ('USER','ASSISTANT')),
  CHECK(status IN ('PENDING','COMPLETED','FAILED','CANCELLED')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(conversation_id,user_id) REFERENCES chat_conversations(id,user_id) ON DELETE CASCADE
);

CREATE TABLE chat_feedback (
  id bigint PRIMARY KEY AUTO_INCREMENT,
  user_id bigint NOT NULL,
  message_id bigint NOT NULL,
  rating integer NOT NULL,
  comment varchar(1000) NOT NULL,
  created_at datetime(6) NOT NULL,
  updated_at datetime(6) NOT NULL,
  UNIQUE(user_id,message_id),
  INDEX idx_chat_feedback_message(message_id,user_id),
  CHECK(rating IN (-1,1)),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(message_id,user_id) REFERENCES chat_messages(id,user_id) ON DELETE CASCADE
);

CREATE TABLE chat_preferences (
  id bigint PRIMARY KEY AUTO_INCREMENT,
  user_id bigint NOT NULL UNIQUE,
  external_consent boolean NOT NULL DEFAULT false,
  created_at datetime(6) NOT NULL,
  updated_at datetime(6) NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
