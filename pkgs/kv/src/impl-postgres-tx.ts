import { assert, hotAssert } from '@pkgs/assert';
import type { Keyword } from '@pkgs/keyword/keyword';
import { assertNamespacedKeyword } from '@pkgs/keyword/keyword';
import { sql } from '@pkgs/sql';

import type { SqlClient } from '@pkgs/sql-client/interface';
import { assertKvRecord, parseKvRecordFromUnknown } from './assert-kv-record';
import type { Kv, KvRecord } from './interface';

function assertKvKey(key: string): asserts key is Keyword {
  assertNamespacedKeyword(hotAssert(), key);
}

export class KvImplPostgresTx implements Kv {
  constructor(
    private readonly db: SqlClient,
    private readonly now: () => number
  ) {}

  async get(key: Keyword): Promise<KvRecord | null> {
    assertKvKey(key);
    const rows = await this.db.query(
      sql<{ value: unknown }>`SELECT value FROM kv WHERE key = ${key}`
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
    const iso = new Date(this.now()).toISOString();
    await this.db.run(
      sql<void>`
        INSERT INTO kv (key, value, last_modified_at)
        VALUES (${key}, ${JSON.stringify(value)}::text::jsonb, ${iso})
        ON CONFLICT (key) DO UPDATE SET
          value = excluded.value,
          last_modified_at = excluded.last_modified_at`
    );
  }

  async zap(key: Keyword): Promise<void> {
    assertKvKey(key);
    await this.db.run(sql<void>`DELETE FROM kv WHERE key = ${key}`);
  }

  async tx<T>(_fn: (tx: Kv) => Promise<T>): Promise<T> {
    assert.fail('KvImplPostgres: nested transaction');
  }
}
