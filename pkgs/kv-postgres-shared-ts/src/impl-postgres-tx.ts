import { hotAssert } from '@pkgs/assert-root-shared-ts/hot-asserts';
import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import type { Keyword } from '@pkgs/keyword-shared-ts/keyword';
import { assertNamespacedKeyword } from '@pkgs/keyword-shared-ts/keyword';
import {
  assertKvRecord,
  parseKvRecordFromUnknown,
} from '@pkgs/kv-root-shared-ts/assert-kv-record';
import type { Kv, KvRecord } from '@pkgs/kv-root-shared-ts/interface';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';

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
      sql<{ value: unknown }>`
        SELECT value FROM kv
        WHERE key = ${key} AND deleted_at IS NULL`
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
    const payload = JSON.stringify(value);
    const updated = await this.db.run(
      sql<void>`
        UPDATE kv
        SET value = ${payload}, updated_at = ${iso}, deleted_at = NULL
        WHERE key = ${key}`
    );
    if (updated.changes > 0) return;
    await this.db.run(
      sql<void>`
        INSERT INTO kv (id, key, value, created_at, updated_at, deleted_at)
        VALUES (${key}, ${key}, ${payload}, ${iso}, ${iso}, ${null})`
    );
  }

  async zap(key: Keyword): Promise<void> {
    assertKvKey(key);
    const iso = new Date(this.now()).toISOString();
    await this.db.run(
      sql<void>`
        UPDATE kv
        SET deleted_at = ${iso}, updated_at = ${iso}
        WHERE key = ${key} AND deleted_at IS NULL`
    );
  }

  async tx<T>(_fn: (tx: Kv) => Promise<T>): Promise<T> {
    assert.fail('KvImplPostgres: nested transaction');
  }
}
