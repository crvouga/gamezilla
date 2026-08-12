/**
 * Portable `entity_store` table DDL (SQLite-shaped TEXT columns; works on
 * Postgres too). Postgres-only ALTER DEFAULT cleanup lives in the Postgres
 * migrate path.
 */

export const ENTITY_STORE_TABLE = 'entity_store';

export const ENTITY_STORE_CREATE_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS ${ENTITY_STORE_TABLE} (
  id text NOT NULL PRIMARY KEY,
  namespace text NOT NULL,
  type text NOT NULL,
  external_id text NOT NULL,
  owner_id text,
  data text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL,
  UNIQUE (namespace, type, external_id)
)
`.trim();

export const ENTITY_STORE_CREATE_INDEX_DDL = [
  `CREATE INDEX IF NOT EXISTS entity_store_namespace_owner_idx ON ${ENTITY_STORE_TABLE} (namespace, owner_id)`,
  `CREATE INDEX IF NOT EXISTS entity_store_namespace_type_idx ON ${ENTITY_STORE_TABLE} (namespace, type)`,
] as const;
