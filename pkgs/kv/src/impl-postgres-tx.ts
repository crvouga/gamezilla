import { assert, hotAssert } from '@pkgs/assert';
import type { Keyword } from '@pkgs/keyword/keyword';
import { assertNamespacedKeyword } from '@pkgs/keyword/keyword';
import { sql, ident } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { assertKvRecord, parseKvRecordFromUnknown } from './assert-kv-record';
import type { Kv, KvRecord } from './interface';

const TABLE = 'kv';
const LAST_MODIFIED_AT = 'last_modified_at';

function assertKvKey(key: string): asserts key is Keyword {
  assertNamespacedKeyword(hotAssert(), key);
}

export class KvImplPostgresTx implements Kv {
  constructor(private readonly db: SqlClient) {}

  async get(key: Keyword): Promise<KvRecord | null> {
    assertKvKey(key);
    const rows = await this.db.query<{ value: unknown }>(
      sql`SELECT value FROM ${ident(TABLE)} WHERE key = ${key}`
    );
    const first = rows[0];
    if (first === null || first === undefined) return null;
    return parseKvRecordFromUnknown(
      hotAssert(),
      first.value,
      'kv postgres tx get'
    );
  }

  async put(key: Keyword, value: KvRecord): Promise<void> {
    assertKvKey(key);
    assertKvRecord(hotAssert(), value, 'kv postgres tx put');
    await this.db.run(sql`
      INSERT INTO ${ident(TABLE)} (key, value) VALUES (${key}, ${JSON.stringify(value)}::text::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, ${ident(LAST_MODIFIED_AT)} = now()`);
  }

  async zap(key: Keyword): Promise<void> {
    assertKvKey(key);
    await this.db.run(sql`DELETE FROM ${ident(TABLE)} WHERE key = ${key}`);
  }

  async tx<T>(_fn: (tx: Kv) => Promise<T>): Promise<T> {
    assert.fail('KvImplPostgres: nested transaction');
  }
}
