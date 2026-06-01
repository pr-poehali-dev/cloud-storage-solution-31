CREATE TABLE IF NOT EXISTS t_p27527697_cloud_storage_soluti.chat_messages (
  id          bigserial PRIMARY KEY,
  user_id     integer NULL REFERENCES t_p27527697_cloud_storage_soluti.users(id),
  username    varchar(64) NOT NULL,
  avatar_seed varchar(32) NOT NULL DEFAULT 'bot',
  message     text NOT NULL,
  is_bot      boolean NOT NULL DEFAULT true,
  msg_type    varchar(16) NOT NULL DEFAULT 'review',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_messages_created_idx ON t_p27527697_cloud_storage_soluti.chat_messages(created_at DESC);

CREATE TABLE IF NOT EXISTS t_p27527697_cloud_storage_soluti.support_messages (
  id          bigserial PRIMARY KEY,
  session_key varchar(64) NOT NULL,
  user_id     integer NULL REFERENCES t_p27527697_cloud_storage_soluti.users(id),
  role        varchar(8) NOT NULL DEFAULT 'user',
  message     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_messages_session_idx ON t_p27527697_cloud_storage_soluti.support_messages(session_key, created_at);