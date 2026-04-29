/**
 * Postgres-backed {@link Kv}. Table layout and DDL are private to this module.
 * For correct `transaction` + advisory locking, use a TCP Postgres `SqlClient`
 * (e.g. `impl-postgres-tcp`) — not Neon's HTTP or WebSocket drivers.
 */
import { assert } from '../assert';
import type { Logger } from '../logger/logger';
import type { SqlClient } from '../sql-client/interface';
import { KvImplPostgresTx } from './impl-postgres-tx';
import type { Kv } from './interface';

const TABLE = 'kv';

const MIGRATIONS = `
CREATE TABLE IF NOT EXISTS kv (
  key        TEXT        PRIMARY KEY,
  value      TEXT        NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

const ADVISORY_LOCK_SQL =
  'SELECT pg_advisory_xact_lock(hashtext(CAST(? AS TEXT))::bigint)';

/** Idempotent Postgres DDL for the `kv` table (same as `KvImplPostgres.migrate`). */
async function runKvPostgresMigrations(
  sqlClient: SqlClient,
  log: Logger
): Promise<void> {
  const existing = await sqlClient.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ?`,
    [TABLE]
  );
  if (existing.length >= 1) {
    log.info('kv postgres migrate: skipped (table already exists)', { table: TABLE });
    return;
  }

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
}

/**
 * Postgres-backed {@link Kv}.
 * Migration: `KvImplPostgres.migrate({ sqlClient, logger })` (static), same as patch-db / entity-db.
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
    await KvImplPostgres.migrate(args);
    return new KvImplPostgres(args.sqlClient);
  }

  /** Idempotent Postgres DDL for the `kv` table (no instance required). */
  static async migrate(args: {
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

  async get(key: string): Promise<string | null> {
    assertNonEmptyKey(key);
    const rows = await this.sqlClient.query<{ value: string }>(
      `SELECT value FROM ${TABLE} WHERE key = ?`,
      [key]
    );
    const first = rows[0];
    return first !== null && first !== undefined ? first.value : null;
  }

  async put(key: string, value: string): Promise<void> {
    assertNonEmptyKey(key);
    await this.sqlClient.run(
      `INSERT INTO ${TABLE} (key, value) VALUES (?, ?)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, value]
    );
  }

  async zap(key: string): Promise<void> {
    assertNonEmptyKey(key);
    await this.sqlClient.run(`DELETE FROM ${TABLE} WHERE key = ?`, [key]);
  }

  async transaction<T>(fn: (tx: Kv) => Promise<T>): Promise<T> {
    return this.sqlClient.transaction(async (sqlTx) => {
      await sqlTx.run(ADVISORY_LOCK_SQL, ['kv']);
      const adapter = new KvImplPostgresTx(sqlTx);
      return fn(adapter);
    });
  }
}

function assertNonEmptyKey(key: string): void {
  assert.ok(
    typeof key === 'string' && key.length > 0,
    'Kv: key must be non-empty string',
    { key }
  );
}
