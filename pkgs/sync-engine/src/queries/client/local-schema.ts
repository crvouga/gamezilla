import { unsafe } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import {
  SYNC_ENGINE_MUTATIONS,
  SYNC_ENGINE_OPTIMISTIC_PEER_ROWS,
  SYNC_ENGINE_PUSH_APPLIED,
  SYNC_ENGINE_SCOPE_META,
  SYNC_ENGINE_WRITE_REJECTIONS,
} from '../../shared/framework-server-ddl';

/**
 * Framework local tables for defineQuery sync.
 * Domain hydration is soft-delete only: merge upserts rows (including
 * `deleted_at`) verbatim from server snapshots. Scope membership tags and
 * peer mutation logs are gone — `sync_engine_scope_meta` is the only cache metadata.
 */
export const FRAMEWORK_LOCAL_DDL = `
CREATE TABLE IF NOT EXISTS ${SYNC_ENGINE_MUTATIONS} (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  args TEXT NOT NULL,
  client_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ${SYNC_ENGINE_SCOPE_META} (
  scope_hash TEXT PRIMARY KEY,
  last_active_at TEXT NOT NULL,
  last_checkpoint TEXT,
  last_hash TEXT
);
CREATE TABLE IF NOT EXISTS ${SYNC_ENGINE_PUSH_APPLIED} (
  topic TEXT PRIMARY KEY,
  last_push_seq TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ${SYNC_ENGINE_WRITE_REJECTIONS} (
  id TEXT PRIMARY KEY,
  mutation_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  code TEXT NOT NULL,
  message TEXT NOT NULL,
  meta TEXT,
  created_at TEXT NOT NULL,
  acknowledged INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS sync_engine_write_rejections_client_id_idx
  ON ${SYNC_ENGINE_WRITE_REJECTIONS} (client_id);
CREATE INDEX IF NOT EXISTS sync_engine_write_rejections_mutation_id_idx
  ON ${SYNC_ENGINE_WRITE_REJECTIONS} (mutation_id);
CREATE TABLE IF NOT EXISTS ${SYNC_ENGINE_OPTIMISTIC_PEER_ROWS} (
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  PRIMARY KEY (table_name, row_id)
);
`;

/** Bump to wipe CACHE tables on next open (hard-cutoff schema change). */
export const SCHEMA_EPOCH = 11;

/** Retired local tables dropped on epoch migrate (legacy + pre-prefix names). */
export const RETIRED_LOCAL_TABLES = [
  '_row_scopes',
  '_upload_state',
  '_peer_applied',
  '_peer_mutations',
  '_topic_applied',
  '_mutations',
  '_mutations_applied',
  'write_rejections',
  '_scope_meta',
  '_push_applied',
  '_sync_topic_seq',
  'inbox_interactions',
  'inbox_preferences',
  'inbox_schema_state',
] as const;

export async function ensureFrameworkSchema(db: SqlClient): Promise<void> {
  const statements = FRAMEWORK_LOCAL_DDL.split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    await db.run(unsafe(stmt));
  }
}
