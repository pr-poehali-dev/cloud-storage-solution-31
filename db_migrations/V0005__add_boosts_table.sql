ALTER TABLE t_p27527697_cloud_storage_soluti.users
  ADD COLUMN IF NOT EXISTS boost_percent numeric(5,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS t_p27527697_cloud_storage_soluti.boosts (
  id          serial PRIMARY KEY,
  user_id     integer NOT NULL REFERENCES t_p27527697_cloud_storage_soluti.users(id),
  amount      numeric(14,2) NOT NULL,
  bonus_pct   numeric(5,2) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);