CREATE TABLE IF NOT EXISTS t_p27527697_cloud_storage_soluti.crypto_balances (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES t_p27527697_cloud_storage_soluti.users(id),
  coin        VARCHAR(20) NOT NULL,
  amount      NUMERIC(24,8) NOT NULL DEFAULT 0,
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, coin)
);

CREATE TABLE IF NOT EXISTS t_p27527697_cloud_storage_soluti.exchange_orders (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES t_p27527697_cloud_storage_soluti.users(id),
  from_currency   VARCHAR(10) NOT NULL,
  from_amount     NUMERIC(24,8) NOT NULL,
  to_currency     VARCHAR(10) NOT NULL,
  to_amount       NUMERIC(24,8) NOT NULL,
  rate            NUMERIC(24,8) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'open',
  taker_user_id   INTEGER REFERENCES t_p27527697_cloud_storage_soluti.users(id),
  comment         TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_exchange_orders_status ON t_p27527697_cloud_storage_soluti.exchange_orders(status);
CREATE INDEX IF NOT EXISTS idx_exchange_orders_user   ON t_p27527697_cloud_storage_soluti.exchange_orders(user_id);
