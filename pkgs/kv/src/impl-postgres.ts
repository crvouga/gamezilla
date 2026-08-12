// @sql-vendor-ok — UNLOGGED / fillfactor migrate knobs are Postgres-only.
/**
 * SQL-backed {@link Kv} (portable SQLite-shaped DML; works on Postgres too).
 * Table layout and DDL are private to this module.
 * DML binds JSON as TEXT with no vendor casts.
 */
import { assert, hotAssert } from '@pkgs/assert';
import type { Keyword } from '@pkgs/keyword/keyword';
import { assertNamespacedKeyword } from '@pkgs/keyword/keyword';
import type { Logger } from '@pkgs/logger/logger';
import { ident, raw, sql } from '@pkgs/sql';

import type { SqlClient } from '@pkgs/sql-client/interface';
import { assertKvRecord, parseKvRecordFromUnknown } from './assert-kv-record';
import { KvImplPostgresTx } from './impl-postgres-tx';
import type { Kv, KvRecord } from './interface';

const TABLE = 'kv';
const LAST_MODIFIED_AT = 'last_modified_at';

/** Per-table storage parameters applied to both fresh and existing tables. */
const STORAGE_PARAMS = `
  fillfactor = 70,
  toast_tuple_target = 8160,
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 100,
  autovacuum_analyze_threshold = 100,
  autovacuum_vacuum_cost_delay = 0
`;

const MIGRATIONS = `
CREATE TABLE IF NOT EXISTS ${TABLE} (
  key        TEXT        PRIMARY KEY,
  value      TEXT        NOT NULL,
  ${LAST_MODIFIED_AT} TEXT NOT NULL
);
`;

/**
 * Legacy installs created `kv` without a `key` primary key (or with only NOT
 * NULL). `ON CONFLICT (key)` requires a unique/PK target — add one idempotently.
 * TRUNCATE first: rows without a PK are not safe to upsert anyway.
 */
async function ensureKvPrimaryKeyOnKeyColumn(
  sqlClient: SqlClient,
  log: Logger
): Promise<void> {
  const rows = await sqlClient.query(sql<{ column_name: string }>`
    SELECT kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
     WHERE tc.table_schema = current_schema()
       AND tc.table_name = ${TABLE}
       AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
       AND kcu.column_name = 'key'`);
  assert.array(rows, 'kv migrate: key constraint query must return array');
  if (rows.length > 0) return;
  log.warn(
    'kv postgres migrate: kv.key has no unique constraint — TRUNCATE + ADD PRIMARY KEY',
    { table: TABLE }
  );
  await sqlClient.run(raw(`TRUNCATE ${TABLE}`));
  await sqlClient.run(raw(`ALTER TABLE ${TABLE} ADD PRIMARY KEY (key)`));
}

/**
 * Brings an existing kv table up to the Redis-style optimized layout.
 * All operations are idempotent. The UNLOGGED conversion rewrites the heap
 * under ACCESS EXCLUSIVE — fast on tiny tables, disruptive on huge ones.
 */
async function applyKvStorageOptimizations(
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

  // 'p' = permanent (logged), 'u' = unlogged, 't' = temp.
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

/** Idempotent: strip wall DEFAULT now() left by older CREATE TABLE. */
async function dropKvWallDefaults(sqlClient: SqlClient): Promise<void> {
  await sqlClient.run(
    raw(`ALTER TABLE ${TABLE} ALTER COLUMN ${LAST_MODIFIED_AT} DROP DEFAULT`)
  );
}

/** Idempotent Postgres DDL for the `kv` table (same as `KvImplPostgres.migrate`). */
async function runKvPostgresMigrations(
  sqlClient: SqlClient,
  log: Logger
): Promise<void> {
  const existing = await sqlClient.query(sql<{ tablename: string }>`
    SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename = ${TABLE}`);
  if (existing.length === 0) {
    const statements = MIGRATIONS.split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    log.info('kv postgres migrate: applying ddl', {
      table: TABLE,
      statementCount: statements.length,
    });
    for (const stmt of statements) {
      // Full DDL (not a single identifier) — statements are already `;`-split.
      await sqlClient.run(raw(stmt));
    }
    log.info('kv postgres migrate: ddl applied', { table: TABLE });
  } else {
    log.info('kv postgres migrate: table exists (skipping create)', {
      table: TABLE,
    });
  }
  if (existing.length > 0) {
    await ensureKvPrimaryKeyOnKeyColumn(sqlClient, log);
  }
  await dropKvWallDefaults(sqlClient);
  await applyKvStorageOptimizations(sqlClient, log);
  // Table name must be spliced via ident/raw — bound params cannot be FROM targets.
  await sqlClient.query(
    sql<Record<string, unknown>>`SELECT 1 FROM ${ident(TABLE)} LIMIT 0`
  );
}

/**
 * Postgres-backed {@link Kv}.
 *
 * - **`new KvImplPostgres(sqlClient, now)`** — use in hot paths when
 *   {@link KvImplPostgres.migrateUp} has already run (e.g. API request middleware).
 * - **`KvImplPostgres.open(...)`** — runs {@link KvImplPostgres.migrateUp} then
 *   returns an instance (scripts / one-off tools).
 *
 * Migration: `KvImplPostgres.migrateUp({ sqlClient, logger })` (static), same as the sync entity store.
 */
export class KvImplPostgres implements Kv {
  constructor(
    private readonly sqlClient: SqlClient,
    private readonly now: () => number
  ) {}

  /**
   * Ensures the `kv` table exists (idempotent DDL), then returns a ready store.
   */
  static async open(args: {
    sqlClient: SqlClient;
    logger: Logger;
    now: () => number;
  }): Promise<KvImplPostgres> {
    await KvImplPostgres.migrateUp(args);
    return new KvImplPostgres(args.sqlClient, args.now);
  }

  /** Idempotent Postgres DDL for the `kv` table (no instance required). */
  static async migrateUp(args: {
    sqlClient: SqlClient;
    logger: Logger;
  }): Promise<void> {
    const log = args.logger.child({ migration: 'kv-postgres' });
    log.info('kv postgres migrate: start');
    try {
      await runKvPostgresMigrations(args.sqlClient, log);
      log.info('kv postgres migrate: complete');
    } catch (error) {
      log.error('kv postgres migrate: failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async get(key: Keyword): Promise<KvRecord | null> {
    assertKvKey(key);
    const rows = await this.sqlClient.query(
      sql<{ value: unknown }>`SELECT value FROM kv WHERE key = ${key}`
    );
    const first = rows[0];
    if (first === null || first === undefined) return null;
    return parseKvRecordFromUnknown(
      hotAssert(),
      first.value,
      'kv postgres get'
    );
  }

  async put(key: Keyword, value: KvRecord): Promise<void> {
    assertKvKey(key);
    assertKvRecord(hotAssert(), value, 'kv postgres put');
    const iso = new Date(this.now()).toISOString();
    await this.sqlClient.run(
      sql<void>`
        INSERT INTO kv (key, value, last_modified_at)
        VALUES (${key}, ${JSON.stringify(value)}, ${iso})
        ON CONFLICT (key) DO UPDATE SET
          value = excluded.value,
          last_modified_at = excluded.last_modified_at`
    );
  }

  async zap(key: Keyword): Promise<void> {
    assertKvKey(key);
    await this.sqlClient.run(sql<void>`DELETE FROM kv WHERE key = ${key}`);
  }

  async tx<T>(fn: (tx: Kv) => Promise<T>): Promise<T> {
    return this.sqlClient.transaction(async (sqlTx) => {
      const adapter = new KvImplPostgresTx(sqlTx, this.now);
      return fn(adapter);
    });
  }
}

function assertKvKey(key: string): asserts key is Keyword {
  assertNamespacedKeyword(hotAssert(), key);
}
