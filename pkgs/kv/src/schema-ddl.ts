/**
 * Portable `kv` table DDL (SQLite-shaped TEXT columns; works on Postgres too).
 * Postgres-only storage knobs live in {@link KvImplPostgres.migrateUp}.
 */

export const KV_TABLE = 'kv';

export const KV_CREATE_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS ${KV_TABLE} (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  last_modified_at TEXT NOT NULL
)
`.trim();
