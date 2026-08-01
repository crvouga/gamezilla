import { assert, hotAssert } from '@pkgs/assert';
import type { Keyword } from '@pkgs/keyword/keyword';
import { assertNamespacedKeyword } from '@pkgs/keyword/keyword';
import { col, sqlMap } from '@pkgs/sql-map';

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
      sqlMap({ select: ['value'], from: TABLE, where: ['=', 'key', key] })
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
    await this.db.run(
      sqlMap({
        insertInto: TABLE,
        values: {
          key,
          value: ['cast', ['cast', JSON.stringify(value), 'text'], 'jsonb'],
        },
        onConflict: {
          target: ['key'],
          set: {
            value: col('excluded.value'),
            [LAST_MODIFIED_AT]: ['now'],
          },
        },
      })
    );
  }

  async zap(key: Keyword): Promise<void> {
    assertKvKey(key);
    await this.db.run(sqlMap({ deleteFrom: TABLE, where: ['=', 'key', key] }));
  }

  async tx<T>(_fn: (tx: Kv) => Promise<T>): Promise<T> {
    assert.fail('KvImplPostgres: nested transaction');
  }
}
