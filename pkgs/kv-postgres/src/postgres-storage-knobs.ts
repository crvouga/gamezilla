// @sql-vendor-ok — UNLOGGED / fillfactor migrate knobs are Postgres-only.
import { assert } from '@pkgs/assert';
import { KV_TABLE as TABLE } from '@pkgs/kv/schema/tables';
import type { Logger } from '@pkgs/logger/logger';
import { ident, raw, sql } from '@pkgs/sql';
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

/**
 * Brings an existing kv table up to the Redis-style optimized layout.
 * Post-reconcile only — not expressible in defineTable.
 */
export async function applyKvStorageOptimizations(
  sqlClient: SqlClient,
  log: Logger
): Promise<void> {
  log.info('kv postgres migrate: applying storage parameters', {
    table: TABLE,
  });
  await sqlClient.run(raw(`ALTER TABLE ${TABLE} SET (${STORAGE_PARAMS})`));
  await sqlClient.run(
    raw(`ALTER TABLE ${TABLE} ALTER COLUMN value SET STORAGE MAIN`)
  );

  const rows = await sqlClient.query(sql<{ relpersistence: string }>`
    SELECT relpersistence FROM pg_class
     WHERE relname = ${TABLE} AND relnamespace = current_schema()::regnamespace`);
  assert.array(rows, 'kv migrate: pg_class lookup must return array');
  const isUnlogged = rows[0]?.relpersistence === 'u';
  if (!isUnlogged) {
    log.warn(
      'kv postgres migrate: converting kv to UNLOGGED — data will be wiped on Postgres crash and is NOT replicated to standbys; rewrite holds ACCESS EXCLUSIVE',
      { table: TABLE }
    );
    await sqlClient.run(raw(`ALTER TABLE ${TABLE} SET UNLOGGED`));
  }
}

export async function pingKvTable(sqlClient: SqlClient): Promise<void> {
  await sqlClient.query(
    sql<Record<string, unknown>>`SELECT 1 FROM ${ident(TABLE)} LIMIT 0`
  );
}
