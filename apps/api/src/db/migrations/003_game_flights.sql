-- Flight logs of the game (see @brises/shared flight-log.ts): one row per flight, its rows in chunks.
CREATE TABLE IF NOT EXISTS game_flights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  client text NOT NULL,
  build text NOT NULL,
  takeoff_id text NOT NULL,
  takeoff_name text NOT NULL,
  lon double precision NOT NULL,
  lat double precision NOT NULL,
  scenario jsonb NOT NULL,
  options jsonb NOT NULL,
  device jsonb NOT NULL,
  user_agent text,
  ended jsonb,
  chunks integer NOT NULL DEFAULT 0,
  samples integer NOT NULL DEFAULT 0,
  events integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS game_flights_created ON game_flights (created_at DESC);
CREATE INDEX IF NOT EXISTS game_flights_client ON game_flights (client, created_at DESC);

CREATE TABLE IF NOT EXISTS game_flight_chunks (
  flight_id uuid NOT NULL REFERENCES game_flights (id) ON DELETE CASCADE,
  seq integer NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  rows jsonb NOT NULL,
  events jsonb NOT NULL,
  PRIMARY KEY (flight_id, seq)
);
