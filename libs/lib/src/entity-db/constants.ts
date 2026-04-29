/**
 * Default physical table name for Postgres-backed {@link EntityDb} in this app.
 * {@link EntityDbImplPostgres.migrate} uses this when `tableName` is omitted.
 */
export const DEFAULT_POSTGRES_ENTITY_TABLE = 'entities' as const;

/**
 * Canonical Postgres column names for entity-db tables.
 * Consumers should use these in migrations so they stay aligned with the client.
 */
export const ENTITY_DB_COLUMNS = {
  namespace: 'namespace',
  type: 'type',
  id: 'id',
  data: 'data',
  metadata: 'metadata',
  lastModifiedAt: 'last_modified_at',
} as const;
