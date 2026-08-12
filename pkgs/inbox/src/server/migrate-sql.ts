import { type Sql, sql } from '@pkgs/sql';

/** Portable SQLite-shaped inbox DDL (also runs on Postgres). */
export const INBOX_SCHEMA_FINGERPRINT = 'inbox-v4:portable-text-json';

export const CREATE_SCHEMA_STATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS inbox_schema_state (
  id INT PRIMARY KEY,
  schema_fingerprint TEXT NOT NULL
)
`.trim();

export const CREATE_INTERACTIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS inbox_interactions (
  id TEXT PRIMARY KEY,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
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
  CONSTRAINT inbox_interactions_category_check CHECK (
    category IN ('action_required', 'informational', 'system')
  )
)
`.trim();

export const CREATE_INTERACTIONS_SOURCE_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS inbox_interactions_source_uidx
  ON inbox_interactions (user_id, source_namespace, source_type, source_id)
`.trim();

export const CREATE_INTERACTIONS_LIST_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS inbox_interactions_list_idx
  ON inbox_interactions (user_id, active, archived_at, priority DESC, created_at DESC)
`.trim();

export const CREATE_PREFERENCES_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS inbox_preferences (
  id TEXT PRIMARY KEY,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  user_id TEXT NOT NULL,
  preferences TEXT NOT NULL DEFAULT '{}'
)
`.trim();

/** Best-effort: older Postgres installs may still have wall DEFAULTs. */
export const DROP_INTERACTIONS_CREATED_AT_DEFAULT_SQL = `
ALTER TABLE inbox_interactions ALTER COLUMN created_at DROP DEFAULT
`.trim();

export const DROP_INTERACTIONS_UPDATED_AT_DEFAULT_SQL = `
ALTER TABLE inbox_interactions ALTER COLUMN updated_at DROP DEFAULT
`.trim();

export const DROP_PREFERENCES_UPDATED_AT_DEFAULT_SQL = `
ALTER TABLE inbox_preferences ALTER COLUMN updated_at DROP DEFAULT
`.trim();

export const READ_SCHEMA_FINGERPRINT_SQL = `
SELECT schema_fingerprint FROM inbox_schema_state WHERE id = 1
`.trim();

export function upsertSchemaFingerprintSql(fingerprint: string): Sql {
  return sql<void>`
INSERT INTO inbox_schema_state (id, schema_fingerprint)
VALUES (1, ${fingerprint})
ON CONFLICT (id) DO UPDATE SET schema_fingerprint = EXCLUDED.schema_fingerprint`;
}
