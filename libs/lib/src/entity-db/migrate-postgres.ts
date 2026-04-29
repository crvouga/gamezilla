import { assert } from '../assert';
import type { Logger } from '../logger/logger';
import type { SqlClient } from '../sql-client/interface';
import { DEFAULT_POSTGRES_ENTITY_TABLE, ENTITY_DB_COLUMNS } from './constants';
import { qualifiedTable } from './identifier';

const C = ENTITY_DB_COLUMNS;

export type MigrateEntityDbPostgresArgs = {
  sqlClient: SqlClient;
  logger: Logger;
  /** Defaults to {@link DEFAULT_POSTGRES_ENTITY_TABLE}. */
  tableName?: string;
  schema?: string;
};

function catalogSchemaName(schema: string | undefined): string {
  return schema !== undefined && schema.length > 0 ? schema : 'public';
}

/** Physical LIST partition that catches all `namespace` values until dedicated partitions are added. */
function listDefaultPartitionBaseName(tableBaseName: string): string {
  return `${tableBaseName}_default`;
}

function buildEntityDbDdl(
  qualifiedParentName: string,
  qualifiedDefaultPartitionName: string,
  tableBaseName: string
): string {
  return `
CREATE TABLE IF NOT EXISTS ${qualifiedParentName} (
  ${C.namespace} TEXT NOT NULL,
  ${C.type} TEXT NOT NULL,
  ${C.id} TEXT NOT NULL,
  ${C.data} JSONB NOT NULL,
  ${C.metadata} JSONB NOT NULL DEFAULT '{}'::jsonb,
  ${C.lastModifiedAt} TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (${C.namespace}, ${C.type}, ${C.id})
) PARTITION BY LIST (${C.namespace});

CREATE TABLE IF NOT EXISTS ${qualifiedDefaultPartitionName} PARTITION OF ${qualifiedParentName} DEFAULT;

CREATE INDEX IF NOT EXISTS ${tableBaseName}_type_id_idx
  ON ${qualifiedParentName} (${C.type}, ${C.id});

CREATE INDEX IF NOT EXISTS ${tableBaseName}_last_modified_at_idx
  ON ${qualifiedParentName} (${C.lastModifiedAt} DESC);

CREATE INDEX IF NOT EXISTS ${tableBaseName}_namespace_type_last_modified_at_idx
  ON ${qualifiedParentName} (${C.namespace}, ${C.type}, ${C.lastModifiedAt} DESC);

CREATE INDEX IF NOT EXISTS ${tableBaseName}_data_gin_idx
  ON ${qualifiedParentName} USING GIN (${C.data} jsonb_path_ops);

CREATE INDEX IF NOT EXISTS ${tableBaseName}_metadata_gin_idx
  ON ${qualifiedParentName} USING GIN (${C.metadata} jsonb_path_ops);
`.trim();
}

async function runEntityDbPostgresMigrationWork(
  sqlClient: SqlClient,
  log: Logger,
  tableName: string,
  schema: string | undefined
): Promise<void> {
  const qualified = qualifiedTable(tableName, schema);
  const schemaName = catalogSchemaName(schema);
  const tableBase = tableName;

  const existing = await sqlClient.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = ? AND tablename = ?`,
    [schemaName, tableBase]
  );
  assert.array(existing, 'entity-db migrate: existing check must return array');
  if (existing.length >= 1) {
    log.info('entity-db postgres migrate: table exists, verifying schema');
    await assertEntityDbSchema(sqlClient, schemaName, tableBase);
    log.info('entity-db postgres migrate: complete (skipped ddl)');
    return;
  }

  const qualifiedDefault = qualifiedTable(
    listDefaultPartitionBaseName(tableBase),
    schema
  );
  const ddl = buildEntityDbDdl(qualified, qualifiedDefault, tableBase);
  const statements = ddl
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  log.info('entity-db postgres migrate: applying ddl', {
    statementCount: statements.length,
    qualifiedTable: qualified,
  });
  for (const stmt of statements) {
    await sqlClient.run(stmt);
  }
  await assertEntityDbSchema(sqlClient, schemaName, tableBase);
  log.info('entity-db postgres migrate: complete');
}

async function assertEntityDbSchema(
  sqlClient: SqlClient,
  schemaName: string,
  tableBaseName: string
): Promise<void> {
  const tables = await sqlClient.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = ? AND tablename = ?`,
    [schemaName, tableBaseName]
  );
  assert.array(tables, 'entity-db migrate: pg_tables query must return array');
  assert.equals(
    tables.length,
    1,
    'entity-db migrate: expected entity-db parent table',
    { schemaName, tableBaseName, tables }
  );

  const rel = await sqlClient.query<{ relkind: string }>(
    `SELECT c.relkind::text AS relkind
     FROM pg_catalog.pg_class c
     JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = ? AND c.relname = ?`,
    [schemaName, tableBaseName]
  );
  assert.array(rel, 'entity-db migrate: relkind query must return array');
  assert.equals(rel.length, 1, 'entity-db migrate: expected pg_class row', {
    schemaName,
    tableBaseName,
    rel,
  });
  const relkind = rel[0]!.relkind;
  assert.ok(
    relkind === 'p',
    'entity-db migrate: parent must be LIST-partitioned on namespace (relkind p); non-partitioned tables require a manual migration',
    { schemaName, tableBaseName, relkind }
  );

  const parts = await sqlClient.query<{ relname: string }>(
    `SELECT c.relname
     FROM pg_inherits i
     JOIN pg_catalog.pg_class c ON c.oid = i.inhrelid
     JOIN pg_catalog.pg_class p ON p.oid = i.inhparent
     JOIN pg_catalog.pg_namespace n ON n.oid = p.relnamespace
     WHERE n.nspname = ? AND p.relname = ?`,
    [schemaName, tableBaseName]
  );
  assert.array(parts, 'entity-db migrate: partition list query must return array');
  assert.ok(
    parts.length >= 1,
    'entity-db migrate: expected at least one LIST partition (e.g. DEFAULT)',
    { schemaName, tableBaseName, parts }
  );

  const idx = await sqlClient.query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes WHERE schemaname = ? AND tablename = ?`,
    [schemaName, tableBaseName]
  );
  assert.array(idx, 'entity-db migrate: pg_indexes query must return array');
  assert.equals(
    idx.length,
    6,
    'entity-db migrate: expected PK index + 5 secondary indexes on parent',
    { schemaName, tableBaseName, idx }
  );
}

/**
 * Idempotent DDL for the standard entity-db table (same shape as `EntityDbImplPostgres`).
 * Prefer `EntityDbImplPostgres.migrate` at call sites; this function is the implementation.
 */
export async function migrateEntityDbPostgres(
  args: MigrateEntityDbPostgresArgs
): Promise<void> {
  const { sqlClient, schema, logger } = args;
  const tableName = args.tableName ?? DEFAULT_POSTGRES_ENTITY_TABLE;
  assert.defined(sqlClient, 'entity-db migrate: sqlClient is required');
  assert.defined(logger, 'entity-db migrate: logger is required');
  const log = logger.child({
    migration: 'entity-db-postgres',
    tableName,
    schema: catalogSchemaName(schema),
  });
  log.info('entity-db postgres migrate: start');
  try {
    await runEntityDbPostgresMigrationWork(sqlClient, log, tableName, schema);
  } catch (error) {
    log.error('entity-db postgres migrate: failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
