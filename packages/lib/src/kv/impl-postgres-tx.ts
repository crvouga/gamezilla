import { assert } from '../assert';
import { assertNamespacedKeyword } from '../keyword/keyword';
import type { Keyword } from '../keyword/keyword';
import type { SqlClient } from '../sql-client/interface';
import type { Kv } from './interface';

const TABLE = 'kv';

function assertKvKey(key: string): asserts key is Keyword {
  assertNamespacedKeyword(key);
}

export class KvImplPostgresTx implements Kv {
  constructor(private readonly sql: SqlClient) {}

  async get(key: Keyword): Promise<string | null> {
    assertKvKey(key);
    const rows = await this.sql.query<{ value: string }>(
      `SELECT value FROM ${TABLE} WHERE key = ?`,
      [key]
    );
    const first = rows[0];
    return first !== null && first !== undefined ? first.value : null;
  }

  async put(key: Keyword, value: string): Promise<void> {
    assertKvKey(key);
    await this.sql.run(
      `INSERT INTO ${TABLE} (key, value) VALUES (?, ?)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, last_modified_at = now()`,
      [key, value]
    );
  }

  async zap(key: Keyword): Promise<void> {
    assertKvKey(key);
    await this.sql.run(`DELETE FROM ${TABLE} WHERE key = ?`, [key]);
  }

  async transaction<T>(_fn: (tx: Kv) => Promise<T>): Promise<T> {
    assert.fail('KvImplPostgres: nested transaction');
  }
}
