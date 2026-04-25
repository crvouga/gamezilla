import { assert } from '../assert';
import type { SqlClient } from '../sql-client/interface';
import type { Kv } from './interface';

const TABLE = 'kv';

function assertNonEmptyKey(key: string): void {
  assert.ok(
    typeof key === 'string' && key.length > 0,
    'Kv: key must be non-empty string',
    { key }
  );
}

export class KvImplPostgresTx implements Kv {
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
