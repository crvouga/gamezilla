import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
import { unsafe } from '@pkgs/sql';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';

import { allocateTopicCheckpoint } from './allocate-topic-checkpoint';

describe('allocateTopicCheckpoint', () => {
  async function openDb() {
    const raw = new Database(':memory:');
    const db = new SqlClientImplBunSqlite(raw);
    await db.connect();
    await db.run(
      unsafe(`
      CREATE TABLE _sync_topic_checkpoint (
        topic TEXT PRIMARY KEY,
        n INTEGER NOT NULL
      )
    `)
    );
    return db;
  }

  test('strictly monotonic per topic', async () => {
    const db = await openDb();
    const a1 = await allocateTopicCheckpoint(db, 'user:a');
    const a2 = await allocateTopicCheckpoint(db, 'user:a');
    const b1 = await allocateTopicCheckpoint(db, 'user:b');
    expect(a1).toBe('1');
    expect(a2).toBe('2');
    expect(b1).toBe('1');
  });

  test('concurrent allocates stay monotonic', async () => {
    const db = await openDb();
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        allocateTopicCheckpoint(db, 'user:concurrent')
      )
    );
    const nums = results.map((r) => Number(r)).sort((a, b) => a - b);
    expect(nums).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });
});
