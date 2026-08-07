import { type Sql, sql } from '@pkgs/sql';

export const INBOX_SCHEMA_FINGERPRINT = 'inbox-v1:initial';

export const CREATE_SCHEMA_STATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS inbox_schema_state (
  id INT PRIMARY KEY,
  schema_fingerprint TEXT NOT NULL
)
`.trim();

export const CREATE_INTERACTIONS_TABLE_SQL = `
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
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
  user_id TEXT PRIMARY KEY,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)
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
