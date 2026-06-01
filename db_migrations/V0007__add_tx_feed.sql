CREATE TABLE IF NOT EXISTS t_p27527697_cloud_storage_soluti.tx_feed (
  id          bigserial PRIMARY KEY,
  tx_hash     varchar(66) NOT NULL,
  from_addr   varchar(42) NOT NULL,
  to_addr     varchar(42) NOT NULL,
  from_cur    varchar(10) NOT NULL,
  to_cur      varchar(10) NOT NULL,
  from_amount numeric(20,6) NOT NULL,
  to_amount   numeric(20,6) NOT NULL,
  status      varchar(16) NOT NULL DEFAULT 'confirmed',
  is_bot      boolean NOT NULL DEFAULT true,
  user_id     integer NULL REFERENCES t_p27527697_cloud_storage_soluti.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tx_feed_created_idx ON t_p27527697_cloud_storage_soluti.tx_feed(created_at DESC);