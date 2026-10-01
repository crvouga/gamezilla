// @sql-vendor-ok — UNLOGGED / fillfactor migrate knobs are Postgres-only.
import { assert } from '@pkgs/assert';
import { KV_TABLE as TABLE } from '@pkgs/kv/schema/tables';
import type { Logger } from '@pkgs/logger/logger';
import { raw, sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

const STORAGE_PARAMS = `
  fillfactor = 70,
  toast_tuple_target = 8160,
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 100,
  autovacuum_analyze_threshold = 100,
  autovacuum_vacuum_cost_delay = 0
`;

function errorCode(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return '';
  }
  return typeof error.code === 'string' ? error.code : '';
}

function isUnsupportedStorageOptimization(error: unknown): boolean {
  const code = errorCode(error);
  if (code === '0A000') return true;
  return (
    code.startsWith('NK') &&
    error instanceof Error &&
    error.message.includes('not implemented')
  );
}

function isTableUnavailable(error: unknown): boolean {
  return errorCode(error) === '42P01';
}

type StorageOptimizationResult =
  | 'applied'
  | 'unsupported'
  | 'table-unavailable';

async function runStorageOptimization(args: {
  readonly sqlClient: SqlClient;
  readonly log: Logger;
  readonly name: string;
  readonly statement: string;
  readonly alreadyInTransaction: boolean;
  readonly allowTemporarilyUnavailableTable: boolean;
}): Promise<StorageOptimizationResult> {
  if (args.alreadyInTransaction) {
    await args.sqlClient.run(raw('SAVEPOINT kv_storage_optimization'));
  }
  try {
    await args.sqlClient.run(raw(args.statement));
    return 'applied';
  } catch (error) {
    if (args.alreadyInTransaction) {
      await args.sqlClient.run(
        raw('ROLLBACK TO SAVEPOINT kv_storage_optimization')
      );
    }
    if (args.allowTemporarilyUnavailableTable && isTableUnavailable(error)) {
      args.log.warn(
        'kv postgres reconcile: storage optimization deferred until the table is visible',
        { table: TABLE, optimization: args.name, code: errorCode(error) }
      );
      return 'table-unavailable';
    }
    if (!isUnsupportedStorageOptimization(error)) throw error;
    args.log.warn(
      'kv postgres reconcile: storage optimization is unsupported',
      {
        table: TABLE,
        optimization: args.name,
        code: errorCode(error),
      }
    );
    return 'unsupported';
  } finally {
    if (args.alreadyInTransaction) {
      await args.sqlClient.run(
        raw('RELEASE SAVEPOINT kv_storage_optimization')
      );
    }
  }
}

export type KvStorageOptimizationOptions = {
  readonly alreadyInTransaction?: boolean;
  readonly allowTemporarilyUnavailableTable?: boolean;
};

/**
 * Brings an existing kv table up to the Redis-style optimized layout.
 * Post-reconcile only — not expressible in defineTable.
 */
export async function applyKvStorageOptimizations(
  sqlClient: SqlClient,
  log: Logger,
  options?: KvStorageOptimizationOptions
): Promise<void> {
  const alreadyInTransaction = options?.alreadyInTransaction ?? false;
  const allowTemporarilyUnavailableTable =
    options?.allowTemporarilyUnavailableTable ?? false;
  log.info('kv postgres reconcile: applying storage parameters', {
    table: TABLE,
  });
  const tableParameters = await runStorageOptimization({
    sqlClient,
    log,
    name: 'table parameters',
    statement: `ALTER TABLE ${TABLE} SET (${STORAGE_PARAMS})`,
    alreadyInTransaction,
    allowTemporarilyUnavailableTable,
  });
  if (tableParameters === 'table-unavailable') return;
  const valueStorage = await runStorageOptimization({
    sqlClient,
    log,
    name: 'value storage',
    statement: `ALTER TABLE ${TABLE} ALTER COLUMN value SET STORAGE MAIN`,
    alreadyInTransaction,
    allowTemporarilyUnavailableTable,
  });
  if (valueStorage === 'table-unavailable') return;

  const rows = await sqlClient.query(sql<{ relpersistence: string }>`
    SELECT relpersistence FROM pg_class
     WHERE relname = ${TABLE} AND relnamespace = current_schema()::regnamespace`);
  assert.array(rows, 'kv reconcile: pg_class lookup must return array');
  if (rows.length === 0 && allowTemporarilyUnavailableTable) {
    log.warn(
      'kv postgres reconcile: storage optimization deferred until the table is visible',
      { table: TABLE, optimization: 'unlogged table', code: '42P01' }
    );
    return;
  }
  const isUnlogged = rows[0]?.relpersistence === 'u';
  if (!isUnlogged) {
    log.warn(
      'kv postgres reconcile: converting kv to UNLOGGED — data will be wiped on Postgres crash and is NOT replicated to standbys; rewrite holds ACCESS EXCLUSIVE',
      { table: TABLE }
    );
    await runStorageOptimization({
      sqlClient,
      log,
      name: 'unlogged table',
      statement: `ALTER TABLE ${TABLE} SET UNLOGGED`,
      alreadyInTransaction,
      allowTemporarilyUnavailableTable,
    });
  }
}
