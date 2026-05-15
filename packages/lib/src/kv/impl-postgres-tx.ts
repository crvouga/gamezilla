import { assert } from '../assert';
import { assertNamespacedKeyword } from '../keyword/keyword';
import type { Keyword } from '../keyword/keyword';
import type { SqlClient } from '../sql-client/interface';
import { assertKvRecord, parseKvRecordFromUnknown } from './assert-kv-record';
import type { Kv, KvRecord } from './interface';

const TABLE = 'kv';

function assertKvKey(key: string): asserts key is Keyword {
  assertNamespacedKeyword(key);
}

export class KvImplPostgresTx implements Kv {
  constructor(private readonly sql: SqlClient) {}

  async get(key: Keyword): Promise<KvRecord | null> {
    assertKvKey(key);
    const rows = await this.sql.query<{ value: unknown }>(
      `SELECT value FROM ${TABLE} WHERE key = ?`,
      [key]
    );
    const first = rows[0];
    if (first === null || first === undefined) return null;
    return parseKvRecordFromUnknown(first.value, 'kv postgres tx get');
  }

  async put(key: Keyword, value: KvRecord): Promise<void> {
    assertKvKey(key);
    assertKvRecord(value, 'kv postgres tx put');
    await this.sql.run(
      `INSERT INTO ${TABLE} (key, value) VALUES (?, ?::text::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, last_modified_at = now()`,
      [key, JSON.stringify(value)]
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
