import { unsafe } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

/**
 * Framework local tables for defineQuery sync.
 * Domain hydration is soft-delete only: merge upserts rows (including
 * `deleted_at`) verbatim from server snapshots. Scope membership tags and
 * peer mutation logs are gone — `_scope_meta` is the only cache metadata.
 */
export const FRAMEWORK_LOCAL_DDL = `
CREATE TABLE IF NOT EXISTS _mutations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  args TEXT NOT NULL,
  client_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS _scope_meta (
  scope_hash TEXT PRIMARY KEY,
  last_active_at TEXT NOT NULL,
  last_checkpoint TEXT,
  last_hash TEXT
);
CREATE TABLE IF NOT EXISTS _push_applied (
  topic TEXT PRIMARY KEY,
  last_push_seq TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS write_rejections (
  id TEXT PRIMARY KEY,
  mutation_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  code TEXT NOT NULL,
  message TEXT NOT NULL,
  meta TEXT,
  created_at TEXT NOT NULL,
  acknowledged INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS write_rejections_client_id_idx
  ON write_rejections (client_id);
CREATE INDEX IF NOT EXISTS write_rejections_mutation_id_idx
  ON write_rejections (mutation_id);
`;

/** Bump to wipe CACHE tables on next open (hard-cutoff schema change). */
export const SCHEMA_EPOCH = 8;

/** Retired local tables dropped on epoch migrate. */
export const RETIRED_LOCAL_TABLES = [
  '_row_scopes',
  '_upload_state',
  '_peer_applied',
  '_peer_mutations',
  '_topic_applied',
] as const;

export async function ensureFrameworkSchema(db: SqlClient): Promise<void> {
  const statements = FRAMEWORK_LOCAL_DDL.split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    await db.run(unsafe(stmt));
  }
}
