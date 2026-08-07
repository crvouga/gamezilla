import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
import { sql, unsafe } from '@pkgs/sql';
import { createPgMemSqlClient } from '@pkgs/sql-client/postgres/impl-pg-mem';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';

import { allocateTopicPushSeq } from './allocate-topic-push-seq';

describe('allocateTopicPushSeq', () => {
  async function openDb() {
    const raw = new Database(':memory:');
    const db = new SqlClientImplBunSqlite(raw);
    await db.connect();
    await db.run(
      unsafe(`
      CREATE TABLE _sync_topic_seq (
        topic TEXT PRIMARY KEY,
        n INTEGER NOT NULL
      )
    `)
    );
    return db;
  }

  test('strictly monotonic per topic', async () => {
    const db = await openDb();
    const a1 = await allocateTopicPushSeq(db, 'user:a');
    const a2 = await allocateTopicPushSeq(db, 'user:a');
    const b1 = await allocateTopicPushSeq(db, 'user:b');
    expect(a1).toBe('1');
    expect(a2).toBe('2');
    expect(b1).toBe('1');
  });

  test('concurrent allocates stay monotonic', async () => {
    const db = await openDb();
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        allocateTopicPushSeq(db, 'user:concurrent')
      )
    );
    const nums = results.map((r) => Number(r)).sort((a, b) => a - b);
    expect(nums).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });
});

describe('FRAMEWORK_SERVER_DDL topic seq rename', () => {
  test('preserves _sync_topic_seq counter values across rename', async () => {
    const { sqlClient } = createPgMemSqlClient();
    await sqlClient.connect();

    // Pre-rename table with live counter values (as on an existing install).
    await sqlClient.run(
      unsafe(`
      CREATE TABLE public._sync_topic_checkpoint (
        topic text NOT NULL,
        n bigint NOT NULL,
        PRIMARY KEY (topic)
      )
    `)
    );
    await sqlClient.run(sql`
      INSERT INTO _sync_topic_checkpoint (topic, n)
      VALUES ('user:a', 17), ('room:s1', 3)
    `);

    // Mirror the idempotent rename path from FRAMEWORK_SERVER_DDL (pg-mem
    // lacks plpgsql DO blocks; exercise the ALTER RENAME itself).
    await sqlClient.run(
      unsafe(
        'ALTER TABLE public._sync_topic_checkpoint RENAME TO _sync_topic_seq'
      )
    );

    const rows = await sqlClient.query(sql<{ topic: string; n: number }>`
      SELECT topic, n FROM _sync_topic_seq ORDER BY topic
    `);
    expect(rows).toEqual([
      { topic: 'room:s1', n: 3 },
      { topic: 'user:a', n: 17 },
    ]);
  });
});
