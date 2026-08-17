-- @libs/notifications canonical DDL (owned by the Notification Center package).
-- Portable SQLite-shaped types (also applied on Postgres).
-- Applied via inbox migrate() at API boot — not via libs/db schema.sql.

CREATE TABLE IF NOT EXISTS notifications_schema_state (
  id INT PRIMARY KEY,
  schema_fingerprint TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
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
  deep_link_params TEXT NOT NULL DEFAULT '{}',
  actions TEXT NOT NULL DEFAULT '[]',
  payload TEXT NOT NULL DEFAULT '{}',
  expires_at TEXT,
  read_at TEXT,
  archived_at TEXT,
  dismissed_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT notifications_category_check CHECK (
    category IN ('action_required', 'informational', 'system')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS notifications_source_uidx
  ON notifications (user_id, source_namespace, source_type, source_id);

CREATE INDEX IF NOT EXISTS notifications_list_idx
  ON notifications (user_id, active, archived_at, priority DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS notifications_preferences_REMOVED (
  user_id TEXT PRIMARY KEY,
  preferences TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);
