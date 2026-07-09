-- ============ Base schema ============
-- Idempotent Postgres DDL for the PowerSync source database.
-- Re-run in full on every deploy. Statements must stay safe to repeat.

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ,
  platform TEXT,
  os_name TEXT,
  os_version TEXT,
  device_model_name TEXT,
  device_brand TEXT,
  device_name TEXT,
  app_version TEXT,
  app_build_number TEXT,
  user_agent TEXT,
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS devices_id_idx ON devices (id);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stripe_customer_id TEXT
);

CREATE TABLE IF NOT EXISTS account_providers (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  provider TEXT,
  provider_user_id TEXT,
  email TEXT,
  linked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS account_providers_account_id_idx
  ON account_providers (account_id);
CREATE INDEX IF NOT EXISTS account_providers_provider_lookup_idx
  ON account_providers (provider, provider_user_id);

CREATE TABLE IF NOT EXISTS account_sessions (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS account_sessions_device_id_idx
  ON account_sessions (device_id);
CREATE INDEX IF NOT EXISTS account_sessions_account_id_idx
  ON account_sessions (account_id);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  display_name TEXT NOT NULL DEFAULT '',
  avatar_config JSONB
);

CREATE TABLE IF NOT EXISTS spaces (
  id TEXT PRIMARY KEY,
  title TEXT,
  host_id TEXT,
  created_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS spaces_host_id_idx ON spaces (host_id);
CREATE INDEX IF NOT EXISTS spaces_created_at_idx ON spaces (created_at DESC);
CREATE INDEX IF NOT EXISTS spaces_ended_at_idx ON spaces (ended_at);

CREATE TABLE IF NOT EXISTS space_memberships (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL,
  space_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS space_memberships_guest_id_idx
  ON space_memberships (guest_id);
CREATE INDEX IF NOT EXISTS space_memberships_space_id_idx
  ON space_memberships (space_id);
CREATE INDEX IF NOT EXISTS space_memberships_joined_at_idx
  ON space_memberships (joined_at ASC);

CREATE TABLE IF NOT EXISTS chess_puzzles (
  id TEXT PRIMARY KEY,
  fen TEXT NOT NULL,
  moves TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 0,
  rating_deviation INTEGER NOT NULL DEFAULT 0,
  popularity INTEGER NOT NULL DEFAULT 0,
  nb_plays INTEGER NOT NULL DEFAULT 0,
  themes JSONB NOT NULL DEFAULT '[]'::jsonb,
  game_url TEXT,
  opening_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  sync_pool BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE chess_puzzles
  ADD COLUMN IF NOT EXISTS sync_pool BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS chess_puzzles_rating_idx ON chess_puzzles (rating);
CREATE INDEX IF NOT EXISTS chess_puzzles_popularity_idx
  ON chess_puzzles (popularity DESC);
CREATE INDEX IF NOT EXISTS chess_puzzles_rating_popularity_idx
  ON chess_puzzles (rating, popularity DESC);
CREATE INDEX IF NOT EXISTS chess_puzzles_sync_pool_popularity_idx
  ON chess_puzzles (rating, popularity DESC)
  WHERE sync_pool = true;

DROP TABLE IF EXISTS chess_puzzle_sync_pool;

CREATE TABLE IF NOT EXISTS chess_puzzle_load (
  id TEXT PRIMARY KEY,
  source_etag TEXT,
  cursor TEXT,
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS chess_puzzle_profiles (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 1200,
  rating_deviation INTEGER NOT NULL DEFAULT 350,
  last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chess_puzzle_profiles_owner_id_idx
  ON chess_puzzle_profiles (owner_id);

CREATE TABLE IF NOT EXISTS chess_puzzle_interactions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  puzzle_id TEXT NOT NULL,
  puzzle_rating INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL,
  solve_idx INTEGER NOT NULL DEFAULT 0,
  uci TEXT,
  correct BOOLEAN,
  rating_before INTEGER NOT NULL DEFAULT 0,
  rating_after INTEGER NOT NULL DEFAULT 0,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chess_puzzle_interactions_owner_id_idx
  ON chess_puzzle_interactions (owner_id);
CREATE INDEX IF NOT EXISTS chess_puzzle_interactions_puzzle_id_idx
  ON chess_puzzle_interactions (puzzle_id);
CREATE INDEX IF NOT EXISTS chess_puzzle_interactions_at_idx
  ON chess_puzzle_interactions (at DESC);

CREATE TABLE IF NOT EXISTS client_config (
  id TEXT PRIMARY KEY,
  google_web_client_id TEXT
);

CREATE TABLE IF NOT EXISTS entity_store (
  id TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,
  type TEXT NOT NULL,
  external_id TEXT NOT NULL,
  owner_id TEXT,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (namespace, type, external_id)
);

CREATE INDEX IF NOT EXISTS entity_store_namespace_type_idx
  ON entity_store (namespace, type);
CREATE INDEX IF NOT EXISTS entity_store_namespace_owner_idx
  ON entity_store (namespace, owner_id);

-- ============ Incremental changes ============

DROP TABLE IF EXISTS patches CASCADE;
DROP VIEW IF EXISTS snapshots CASCADE;
DROP TABLE IF EXISTS snapshots CASCADE;
