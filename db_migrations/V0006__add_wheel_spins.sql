CREATE TABLE IF NOT EXISTS t_p27527697_cloud_storage_soluti.wheel_spins (
  id          serial PRIMARY KEY,
  user_id     integer NOT NULL REFERENCES t_p27527697_cloud_storage_soluti.users(id),
  bet         numeric(14,2) NOT NULL,
  multiplier  numeric(5,2) NOT NULL,
  win_amount  numeric(14,2) NOT NULL,
  segment     varchar(16) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);