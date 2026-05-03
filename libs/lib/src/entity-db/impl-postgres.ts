import { assert } from '../assert';
import type { Logger } from '../logger/logger';
import type { SqlClient } from '../sql-client/interface';
import { DEFAULT_POSTGRES_ENTITY_TABLE, ENTITY_DB_COLUMNS } from './constants';
import { qualifiedTable } from './identifier';
import type {
  CompareVersions,
  Entity,
  EntityDb,
  EntityKey,
  UpsertArgs,
} from './interface';
import {
  assertCompareVersionsResult,
  assertEntityKey,
  assertUpsertArgs,
  ENTITY_DB_LIMITS,
} from './interface';

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
  assert.array(
    parts,
    'entity-db migrate: partition list query must return array'
  );
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

/**
 * Idempotent destructive DDL: drops the partitioned entity-db parent table.
 * `CASCADE` removes LIST partitions (e.g. `{table}_default`) and all indexes.
 * Prefer `EntityDbImplPostgres.migrateDown` at call sites.
 */
export async function migrateDownEntityDbPostgres(
  args: MigrateEntityDbPostgresArgs
): Promise<void> {
  const { sqlClient, schema, logger } = args;
  const tableName = args.tableName ?? DEFAULT_POSTGRES_ENTITY_TABLE;
  assert.defined(sqlClient, 'entity-db migrateDown: sqlClient is required');
  assert.defined(logger, 'entity-db migrateDown: logger is required');
  const log = logger.child({
    migration: 'entity-db-postgres-down',
    tableName,
    schema: catalogSchemaName(schema),
  });
  log.info('entity-db postgres migrateDown: start');
  try {
    await sqlClient.transaction(async (tx) => {
      const qualified = qualifiedTable(tableName, schema);
      const dropSql = `DROP TABLE IF EXISTS ${qualified} CASCADE`;
      log.info('entity-db postgres migrateDown: executing drop', { qualified });
      await tx.run(dropSql);
    });
    log.info('entity-db postgres migrateDown: complete');
  } catch (error) {
    log.error('entity-db postgres migrateDown: failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

type JsonbRow = {
  [K in typeof C.data | typeof C.metadata]: unknown;
} & { [K in typeof C.lastModifiedAt]: unknown };

export class EntityDbImplPostgres implements EntityDb {
  private readonly qTable: string;

  constructor(
    private readonly sqlClient: SqlClient,
    tableName: string,
    schema: string | undefined,
    private readonly compareVersions: CompareVersions
  ) {
    this.qTable = qualifiedTable(tableName, schema);
  }

  /**
   * Idempotent Postgres DDL for the entity-db table (PK + five secondary indexes).
   * Omit `tableName` to use {@link DEFAULT_POSTGRES_ENTITY_TABLE} (same default as `createEntityDb`).
   * `logger` is used for structured migration progress and failures.
   */
  static migrate(args: {
    sqlClient: SqlClient;
    logger: Logger;
  }): Promise<void> {
    return migrateEntityDbPostgres(args);
  }

  /**
   * Idempotent drop of the entity-db table (default `entities` in `public`).
   * Destructive — removes all rows. Use after data has moved to patch-db.
   */
  static migrateDown(args: {
    sqlClient: SqlClient;
    logger: Logger;
    tableName?: string;
    schema?: string;
  }): Promise<void> {
    return migrateDownEntityDbPostgres(args);
  }

  async upsert(args: UpsertArgs): Promise<{ applied: boolean }> {
    assertUpsertArgs(args);
    return this.sqlClient.transaction((tx) =>
      this.runUpsertTransaction(tx, args)
    );
  }

  private async runUpsertTransaction(
    tx: SqlClient,
    args: UpsertArgs
  ): Promise<{ applied: boolean }> {
    const rows = await this.queryExistingForUpdate(tx, args);
    const meta = args.metadata ?? {};
    let branch: 'insert' | 'update' | 'skip';
    if (rows.length === 0) {
      branch = await this.insertNewRow(tx, args, meta);
    } else {
      const first = rows[0];
      assert.defined(first, 'entity-db: PK row missing', { key: args });
      branch = await this.updateOrSkipExisting(tx, args, meta, first);
    }
    assertUpsertBranch(branch);
    const applied = branch === 'insert' || branch === 'update';
    assert.ok(typeof applied === 'boolean', 'entity-db: applied invariant');
    return { applied };
  }

  private async queryExistingForUpdate(
    tx: SqlClient,
    args: UpsertArgs
  ): Promise<JsonbRow[]> {
    const selectSql = `SELECT ${C.data}, ${C.metadata}, ${C.lastModifiedAt}
FROM ${this.qTable}
WHERE ${C.namespace} = ? AND ${C.type} = ? AND ${C.id} = ?
FOR UPDATE`;
    const rows = await tx.query<JsonbRow>(selectSql, [
      args.namespace,
      args.type,
      args.id,
    ]);
    assert.array(rows, 'entity-db: SELECT must return array', {
      namespace: args.namespace,
      type: args.type,
      id: args.id,
    });
    assert.ok(
      rows.length <= ENTITY_DB_LIMITS.MAX_ROWS_FOR_PK_QUERY,
      'entity-db: PK select returned >1 row',
      { count: rows.length, key: args }
    );
    return rows;
  }

  private async insertNewRow(
    tx: SqlClient,
    args: UpsertArgs,
    meta: Record<string, unknown>
  ): Promise<'insert'> {
    const insertSql = `INSERT INTO ${this.qTable}
(${C.namespace}, ${C.type}, ${C.id}, ${C.data}, ${C.metadata}, ${C.lastModifiedAt})
VALUES (?, ?, ?, ?::jsonb, ?::jsonb, now())`;
    await tx.run(insertSql, [
      args.namespace,
      args.type,
      args.id,
      jsonbParam(args.data),
      jsonbParam(meta),
    ]);
    await assertExactlyOneRow(tx, this.qTable, args);
    return 'insert';
  }

  private async updateOrSkipExisting(
    tx: SqlClient,
    args: UpsertArgs,
    meta: Record<string, unknown>,
    row: JsonbRow
  ): Promise<'update' | 'skip'> {
    const existingData = parseJsonbValue(row[C.data], 'existing data', args);
    const cmp = this.compareVersions(args.data, existingData);
    assertCompareVersionsResult(cmp, {
      namespace: args.namespace,
      type: args.type,
      id: args.id,
    });
    if (cmp <= 0) return 'skip';
    const updateSql = `UPDATE ${this.qTable}
SET ${C.data} = ?::jsonb, ${C.metadata} = ?::jsonb, ${C.lastModifiedAt} = now()
WHERE ${C.namespace} = ? AND ${C.type} = ? AND ${C.id} = ?`;
    await tx.run(updateSql, [
      jsonbParam(args.data),
      jsonbParam(meta),
      args.namespace,
      args.type,
      args.id,
    ]);
    await assertExactlyOneRow(tx, this.qTable, args);
    return 'update';
  }

  async get(key: EntityKey): Promise<Entity | null> {
    assertEntityKey(key);
    const sql = `SELECT ${C.data}, ${C.metadata}, ${C.lastModifiedAt}
FROM ${this.qTable}
WHERE ${C.namespace} = ? AND ${C.type} = ? AND ${C.id} = ?`;
    const rows = await this.sqlClient.query<JsonbRow>(sql, [
      key.namespace,
      key.type,
      key.id,
    ]);
    assert.array(rows, 'entity-db: get query must return array', { key });
    assert.ok(
      rows.length <= ENTITY_DB_LIMITS.MAX_ROWS_FOR_PK_QUERY,
      'entity-db: PK select returned >1 row',
      { count: rows.length, key }
    );
    const first = rows[0];
    if (first === undefined) return null;
    return this.mapRowToEntity(key, first);
  }

  async delete(key: EntityKey): Promise<void> {
    assertEntityKey(key);
    const sql = `DELETE FROM ${this.qTable}
WHERE ${C.namespace} = ? AND ${C.type} = ? AND ${C.id} = ?`;
    const run = await this.sqlClient.run(sql, [
      key.namespace,
      key.type,
      key.id,
    ]);
    assert.ok(
      run.changes === 0 || run.changes === 1,
      'entity-db: DELETE must affect 0 or 1 row',
      { changes: run.changes, key }
    );
  }

  private mapRowToEntity(key: EntityKey, row: JsonbRow): Entity {
    assert.ok(
      row[C.data] !== undefined,
      'entity-db: row.data must be defined',
      {
        key,
      }
    );
    const lastMod = row[C.lastModifiedAt];
    const lastModifiedAt = coerceToDate(lastMod, key);
    return {
      namespace: key.namespace,
      type: key.type,
      id: key.id,
      data: parseJsonbValue(row[C.data], 'row data', key),
      metadata: parseJsonbMetadata(row[C.metadata], key),
      lastModifiedAt,
    };
  }
}

function assertUpsertBranch(
  branch: 'insert' | 'update' | 'skip'
): asserts branch is 'insert' | 'update' | 'skip' {
  assert.ok(
    branch === 'insert' || branch === 'update' || branch === 'skip',
    'entity-db: invalid upsert branch',
    { branch }
  );
}

async function assertExactlyOneRow(
  tx: SqlClient,
  qTable: string,
  key: EntityKey
): Promise<void> {
  const verify = await tx.query<{ one: number }>(
    `SELECT 1 AS one FROM ${qTable} WHERE ${C.namespace} = ? AND ${C.type} = ? AND ${C.id} = ?`,
    [key.namespace, key.type, key.id]
  );
  assert.array(verify, 'entity-db: post-write verify must return array', {
    key,
  });
  assert.equals(
    verify.length,
    1,
    'entity-db: expected exactly one row after write',
    { key, count: verify.length }
  );
}

function jsonbParam(value: unknown): string {
  const s = JSON.stringify(value);
  assert.ok(s !== undefined, 'entity-db: jsonb param must serialize', {
    value,
  });
  return s;
}

function parseJsonbMetadata(
  raw: unknown,
  key: EntityKey
): Record<string, unknown> {
  if (typeof raw === 'string') {
    let parsed: unknown;
    assert.notThrows(
      () => {
        parsed = JSON.parse(raw);
      },
      'entity-db: metadata JSON.parse failed',
      { key, raw }
    );
    assert.record(
      parsed,
      'entity-db: row.metadata must deserialize to a plain object',
      { key }
    );
    return parsed;
  }
  assert.record(raw, 'entity-db: row.metadata must be a plain object', {
    key,
    value: raw,
  });
  return raw;
}

function parseJsonbValue(
  raw: unknown,
  label: string,
  key: EntityKey
): unknown {
  if (typeof raw === 'string') {
    let parsed: unknown;
    assert.notThrows(
      () => {
        parsed = JSON.parse(raw);
      },
      `entity-db: ${label} JSON.parse failed`,
      { key, raw }
    );
    return parsed;
  }
  return raw;
}

function coerceToDate(value: unknown, key: EntityKey): Date {
  if (value instanceof Date) {
    assert.ok(!Number.isNaN(value.getTime()), 'entity-db: invalid Date', {
      key,
    });
    return value;
  }
  assert.string(value, 'entity-db: last_modified_at must be string or Date');
  const d = new Date(value);
  assert.ok(!Number.isNaN(d.getTime()), 'entity-db: invalid timestamp string', {
    key,
    value,
  });
  return d;
}
