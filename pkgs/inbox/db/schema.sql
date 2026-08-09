-- @pkgs/inbox canonical DDL (owned by the Interaction Center package).
-- Applied via inbox migrate() at API boot — not via libs/db schema.sql.

CREATE TABLE IF NOT EXISTS inbox_schema_state (
  id INT PRIMARY KEY,
  schema_fingerprint TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inbox_interactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_namespace TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  category TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 0,
  group_key TEXT,
  title TEXT NOT NULL,
  subtitle TEXT,
  body TEXT,
  icon_key TEXT,
  avatar_fallback_label TEXT,
  avatar_config TEXT,
  deep_link_path TEXT,
  deep_link_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT inbox_interactions_category_check CHECK (
    category IN ('action_required', 'informational', 'system')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS inbox_interactions_source_uidx
  ON inbox_interactions (user_id, source_namespace, source_type, source_id);

CREATE INDEX IF NOT EXISTS inbox_interactions_list_idx
  ON inbox_interactions (user_id, active, archived_at, priority DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS inbox_preferences (
  user_id TEXT PRIMARY KEY,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL
);
