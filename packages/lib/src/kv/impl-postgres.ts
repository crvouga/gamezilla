/**
 * Postgres-backed {@link Kv}. Table layout and DDL are private to this module.
 * For correct `transaction` + advisory locking, use a TCP Postgres `SqlClient`
 * (e.g. `impl-postgres-tcp`) — not Neon's HTTP or WebSocket drivers.
 *
 * Schema is aggressively tuned for Redis-style hot-key access:
 *   - UNLOGGED: skip WAL → much higher write throughput. Trade-off: the table
 *     is truncated on a Postgres crash and is NOT replicated to standbys. Use
 *     this only when the source of truth lives elsewhere (cache / scratch).
 *   - fillfactor = 70: leave 30% slack per page so UPDATEs become HOT
 *     (heap-only tuples) and don't dirty the PK index on every overwrite.
 *   - toast_tuple_target = 8160: keep mid-sized values inline rather than
 *     paying a separate TOAST round-trip per get/put.
 *   - autovacuum tuned aggressively: KV tables churn fast; vacuum often,
 *     don't throttle, so dead tuples never pile up.
 *   - value column STORAGE MAIN: compress inline, skip the out-of-line probe
 *     that EXTENDED does on every write.
 *
 * Values are `JSONB` objects whose top-level keys are {@link Keyword}s (same
 * contract as patch-db snapshot attributes). Writes use `?::text::jsonb` so
 * Bun's `bun:sql` driver does not double-encode JSON parameters.
 */
import { assert, hotAssert } from '../assert';
import type { Keyword } from '../keyword/keyword';
import { assertNamespacedKeyword } from '../keyword/keyword';
import type { Logger } from '../logger/logger';
import type { SqlClient } from '../sql-client/interface';
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
CREATE UNLOGGED TABLE IF NOT EXISTS ${TABLE} (
  key        TEXT        PRIMARY KEY,
  value      JSONB       NOT NULL,
  ${LAST_MODIFIED_AT} TIMESTAMPTZ NOT NULL DEFAULT now()
) WITH (${STORAGE_PARAMS});
ALTER TABLE ${TABLE} ALTER COLUMN value SET STORAGE MAIN;
`;

const ADVISORY_LOCK_SQL =
  'SELECT pg_advisory_xact_lock(hashtext(CAST(? AS TEXT))::bigint)';

/** Renames legacy `updated_at` → `last_modified_at` when present (idempotent). */
async function migrateKvLegacyUpdatedAtColumn(
  sqlClient: SqlClient,
  log: Logger
): Promise<void> {
  const legacy = await sqlClient.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = ? AND column_name = 'updated_at'`,
    [TABLE]
  );
  assert.array(legacy, 'kv migrate: legacy column query must return array');
  if (legacy.length === 0) return;
  log.info('kv postgres migrate: renaming updated_at → last_modified_at', {
    table: TABLE,
  });
  await sqlClient.run(
    `ALTER TABLE ${TABLE} RENAME COLUMN updated_at TO ${LAST_MODIFIED_AT}`
  );
}

/**
 * Legacy installs stored `value` as `TEXT`. Convert to `JSONB` and wipe rows
 * so every row satisfies the keyword-record contract going forward.
 */
async function migrateKvValueColumnToJsonbIfNeeded(
  sqlClient: SqlClient,
  log: Logger
): Promise<void> {
  const rows = await sqlClient.query<{ data_type: string }>(
    `SELECT data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = ? AND column_name = 'value'`,
    [TABLE]
  );
  assert.array(rows, 'kv migrate: value column type query must return array');
  const dt = rows[0]?.data_type;
  if (dt !== 'text') return;
  log.info('kv postgres migrate: converting value TEXT → JSONB + TRUNCATE', {
    table: TABLE,
  });
  await sqlClient.run(
    `ALTER TABLE ${TABLE} ALTER COLUMN value TYPE jsonb USING value::jsonb`
  );
  await sqlClient.run(`TRUNCATE ${TABLE}`);
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
  await sqlClient.run(`ALTER TABLE ${TABLE} SET (${STORAGE_PARAMS})`);
  await sqlClient.run(
    `ALTER TABLE ${TABLE} ALTER COLUMN value SET STORAGE MAIN`
  );

  // 'p' = permanent (logged), 'u' = unlogged, 't' = temp.
  const rows = await sqlClient.query<{ relpersistence: string }>(
    `SELECT relpersistence FROM pg_class
     WHERE relname = ? AND relnamespace = 'public'::regnamespace`,
    [TABLE]
  );
  assert.array(rows, 'kv migrate: pg_class lookup must return array');
  const isUnlogged = rows[0]?.relpersistence === 'u';
  if (!isUnlogged) {
    log.warn(
      'kv postgres migrate: converting kv to UNLOGGED — data will be wiped on Postgres crash and is NOT replicated to standbys; rewrite holds ACCESS EXCLUSIVE',
      { table: TABLE }
    );
    await sqlClient.run(`ALTER TABLE ${TABLE} SET UNLOGGED`);
  }
}

/** Idempotent Postgres DDL for the `kv` table (same as `KvImplPostgres.migrate`). */
async function runKvPostgresMigrations(
  sqlClient: SqlClient,
  log: Logger
): Promise<void> {
  const existing = await sqlClient.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ?`,
    [TABLE]
  );
  if (existing.length === 0) {
    const statements = MIGRATIONS.split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    log.info('kv postgres migrate: applying ddl', {
      table: TABLE,
      statementCount: statements.length,
    });
    for (const stmt of statements) {
      await sqlClient.run(stmt);
    }
    log.info('kv postgres migrate: ddl applied', { table: TABLE });
  } else {
    log.info('kv postgres migrate: table exists (skipping create)', {
      table: TABLE,
    });
  }
  await migrateKvLegacyUpdatedAtColumn(sqlClient, log);
  await migrateKvValueColumnToJsonbIfNeeded(sqlClient, log);
  await applyKvStorageOptimizations(sqlClient, log);
}

/**
 * Postgres-backed {@link Kv}.
 *
 * - **`new KvImplPostgres(sqlClient)`** — use in hot paths when
 *   {@link KvImplPostgres.migrateUp} has already run (e.g. API request middleware).
 * - **`KvImplPostgres.open(...)`** — runs {@link KvImplPostgres.migrateUp} then
 *   returns an instance (scripts / one-off tools).
 *
 * Migration: `KvImplPostgres.migrateUp({ sqlClient, logger })` (static), same as patch-db.
 */
export class KvImplPostgres implements Kv {
  constructor(private readonly sqlClient: SqlClient) {}

  /**
   * Ensures the `kv` table exists (idempotent DDL), then returns a ready store.
   */
  static async open(args: {
    sqlClient: SqlClient;
    logger: Logger;
  }): Promise<KvImplPostgres> {
    await KvImplPostgres.migrateUp(args);
    return new KvImplPostgres(args.sqlClient);
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
    const rows = await this.sqlClient.query<{ value: unknown }>(
      `SELECT value FROM ${TABLE} WHERE key = ?`,
      [key]
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
    await this.sqlClient.run(
      `INSERT INTO ${TABLE} (key, value) VALUES (?, ?::text::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, ${LAST_MODIFIED_AT} = now()`,
      [key, JSON.stringify(value)]
    );
  }

  async zap(key: Keyword): Promise<void> {
    assertKvKey(key);
    await this.sqlClient.run(`DELETE FROM ${TABLE} WHERE key = ?`, [key]);
  }

  async tx<T>(fn: (tx: Kv) => Promise<T>): Promise<T> {
    return this.sqlClient.transaction(async (sqlTx) => {
      await sqlTx.run(ADVISORY_LOCK_SQL, ['kv']);
      const adapter = new KvImplPostgresTx(sqlTx);
      return fn(adapter);
    });
  }
}

function assertKvKey(key: string): asserts key is Keyword {
  assertNamespacedKeyword(hotAssert(), key);
}
