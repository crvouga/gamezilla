/**
 * Portable DDL for sync-engine framework tables (SQLite + Postgres).
 * Applied via {@link applyFrameworkServerDdl} at migrate time — not owned by
 * domain `defineSchema` / `@pkgs/db-schema`.
 *
 * Server keeps only idempotency + rejection audit. The client mutation queue
 * lives in local SQLite (`sync_engine_mutations`); it is never written to the
 * server DB.
 *
 * All framework tables use the `sync_engine_` prefix.
 */

export const SYNC_ENGINE_MUTATIONS = 'sync_engine_mutations';
export const SYNC_ENGINE_MUTATIONS_APPLIED = 'sync_engine_mutations_applied';
export const SYNC_ENGINE_WRITE_REJECTIONS = 'sync_engine_write_rejections';
export const SYNC_ENGINE_SCOPE_META = 'sync_engine_scope_meta';
export const SYNC_ENGINE_PUSH_APPLIED = 'sync_engine_push_applied';
export const SYNC_ENGINE_TOPIC_SEQ = 'sync_engine_topic_seq';

/**
 * Single portable DDL for prod Postgres and sim SQLite.
 * Types are SQLite-shaped (TEXT / INTEGER); Postgres accepts them.
 */
export const FRAMEWORK_SERVER_DDL = `
DROP TABLE IF EXISTS sync_engine_mutations;
DROP TABLE IF EXISTS _mutations;

CREATE TABLE IF NOT EXISTS sync_engine_mutations_applied (
  mutation_id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('applied', 'rejected')),
  applied_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sync_engine_mutations_applied_client_id_seq_idx
  ON sync_engine_mutations_applied (client_id, seq);

CREATE TABLE IF NOT EXISTS sync_engine_write_rejections (
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
  ON sync_engine_write_rejections (client_id);
CREATE INDEX IF NOT EXISTS sync_engine_write_rejections_mutation_id_idx
  ON sync_engine_write_rejections (mutation_id);

CREATE TABLE IF NOT EXISTS sync_engine_topic_seq (
  topic TEXT PRIMARY KEY,
  n INTEGER NOT NULL
);
`;

/** @deprecated Alias — sim uses the same portable DDL as production. */
export const FRAMEWORK_SIM_SERVER_DDL = FRAMEWORK_SERVER_DDL;

/** Table names owned by framework DDL (server + local). */
export const FRAMEWORK_TABLE_NAMES = [
  SYNC_ENGINE_MUTATIONS,
  SYNC_ENGINE_MUTATIONS_APPLIED,
  SYNC_ENGINE_WRITE_REJECTIONS,
  SYNC_ENGINE_SCOPE_META,
  SYNC_ENGINE_PUSH_APPLIED,
  SYNC_ENGINE_TOPIC_SEQ,
] as const;

/** Local SQLite durable tables (survive CACHE clear). */
export const FRAMEWORK_DURABLE_TABLE_NAMES = [SYNC_ENGINE_MUTATIONS] as const;

/** Local SQLite cache tables wiped on CACHE clear / epoch bump. */
export const FRAMEWORK_CACHE_TABLE_NAMES = [
  SYNC_ENGINE_SCOPE_META,
  SYNC_ENGINE_WRITE_REJECTIONS,
  SYNC_ENGINE_PUSH_APPLIED,
] as const;
