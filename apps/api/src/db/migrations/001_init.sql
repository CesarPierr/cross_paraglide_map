-- Knowledge base of the French Alps aerology, flying sites, user contributions and caches.
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE sources (
  id text PRIMARY KEY,
  title text NOT NULL,
  url text,
  publisher text,
  type text,
  notes text
);

CREATE TABLE massifs (
  id text PRIMARY KEY,
  name text NOT NULL,
  short_name text NOT NULL,
  region text NOT NULL,
  parent text,
  summary text NOT NULL DEFAULT '',
  bbox geometry(Polygon, 4326) NOT NULL,
  center geometry(Point, 4326) NOT NULL,
  tips jsonb NOT NULL DEFAULT '[]',
  synoptic jsonb NOT NULL DEFAULT '[]',
  sources jsonb NOT NULL DEFAULT '[]',
  sort integer NOT NULL DEFAULT 0
);

-- Breezes, convergences, hazards, spots, routes. `props` follows AtlasFeatureProps.
CREATE TABLE features (
  id text PRIMARY KEY,
  num integer NOT NULL UNIQUE,
  category text NOT NULL,
  massif_id text NOT NULL REFERENCES massifs (id) ON DELETE CASCADE,
  geom geometry(Geometry, 4326) NOT NULL,
  props jsonb NOT NULL,
  status text NOT NULL DEFAULT 'published',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX features_geom_idx ON features USING gist (geom);
CREATE INDEX features_category_idx ON features (category);

-- Documented breezes as the wind model consumes them (one per breeze feature).
CREATE TABLE curated_breezes (
  id text PRIMARY KEY REFERENCES features (id) ON DELETE CASCADE,
  sort integer NOT NULL,
  data jsonb NOT NULL
);

CREATE TABLE model_rules (
  id text PRIMARY KEY,
  data jsonb NOT NULL
);

CREATE TABLE atlas_meta (
  key text PRIMARY KEY,
  value jsonb NOT NULL
);

-- Official and imported flying sites.
CREATE TABLE sites (
  id text PRIMARY KEY,
  provider text NOT NULL,
  kind text NOT NULL,
  name text NOT NULL,
  geom geometry(Point, 4326) NOT NULL,
  altitude real,
  orientations jsonb NOT NULL DEFAULT '[]',
  description text,
  url text,
  status text NOT NULL DEFAULT 'official',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sites_geom_idx ON sites USING gist (geom);

-- User feedback and proposals, moderated before publication.
CREATE TABLE contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  target_ref text,
  category text,
  title text,
  message text NOT NULL,
  geom geometry(Geometry, 4326),
  details jsonb,
  source_url text,
  context jsonb,
  author text,
  email text,
  status text NOT NULL DEFAULT 'pending',
  ip_hash text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  review_note text
);
CREATE INDEX contributions_target_idx ON contributions (target_ref);
CREATE INDEX contributions_status_idx ON contributions (status, created_at DESC);
CREATE INDEX contributions_ip_idx ON contributions (ip_hash, created_at DESC);

-- Upstream responses (weather, external directories) with their expiry.
CREATE TABLE http_cache (
  key text PRIMARY KEY,
  version text,
  fetched_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  payload jsonb NOT NULL
);
CREATE INDEX http_cache_expiry_idx ON http_cache (expires_at);

-- Weighted upstream calls per day, to stay within free quotas.
CREATE TABLE api_usage (
  day date NOT NULL,
  provider text NOT NULL,
  calls real NOT NULL DEFAULT 0,
  PRIMARY KEY (day, provider)
);
