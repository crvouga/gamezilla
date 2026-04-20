/**
 * Postgres-backed {@link Kv}. Table layout and DDL are private to this module.
 * Requires a {@link SqlClient} whose `transaction` provides real serializable
 * isolation (e.g. {@link SqlClientImplPlanetScalePostgresWs}).
 */
import { assert } from '../assert';
import type { SqlClient } from '../sql-client/interface';
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

export class KvImplPostgres implements Kv {
  private constructor(private readonly sqlClient: SqlClient) {}

  /**
   * Ensures the `kv` table exists (idempotent DDL), then returns a ready store.
   */
  static async open(sqlClient: SqlClient): Promise<KvImplPostgres> {
    const kv = new KvImplPostgres(sqlClient);
    await kv.migrate();
    return kv;
  }

  private async migrate(): Promise<void> {
    const existing = await this.sqlClient.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ?`,
      [TABLE]
    );
    if (existing.length >= 1) return;

    const statements = MIGRATIONS.split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      await this.sqlClient.run(stmt);
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

class KvImplPostgresTx implements Kv {
  constructor(private readonly sql: SqlClient) {}

  async get(key: string): Promise<string | null> {
    assertNonEmptyKey(key);
    const rows = await this.sql.query<{ value: string }>(
      `SELECT value FROM ${TABLE} WHERE key = ?`,
      [key]
    );
    const first = rows[0];
    return first !== null && first !== undefined ? first.value : null;
  }

  async put(key: string, value: string): Promise<void> {
    assertNonEmptyKey(key);
    await this.sql.run(
      `INSERT INTO ${TABLE} (key, value) VALUES (?, ?)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, value]
    );
  }

  async zap(key: string): Promise<void> {
    assertNonEmptyKey(key);
    await this.sql.run(`DELETE FROM ${TABLE} WHERE key = ?`, [key]);
  }

  async transaction<T>(_fn: (tx: Kv) => Promise<T>): Promise<T> {
    assert.fail('KvImplPostgres: nested transaction');
  }
}

function assertNonEmptyKey(key: string): void {
  assert.ok(
    typeof key === 'string' && key.length > 0,
    'Kv: key must be non-empty string',
    { key }
  );
}
