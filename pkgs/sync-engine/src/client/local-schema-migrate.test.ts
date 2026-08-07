import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
import { defineSchema } from '@pkgs/db-schema';
import { sql, unsafe } from '@pkgs/sql';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';

import { migrateLocalSchema } from './local-schema-migrate';

const emptySchema = defineSchema({ tables: {} });

describe('migrateLocalSchema epoch bump', () => {
  test('epoch 6→7 drops _topic_applied, creates _push_applied, keeps _mutations', async () => {
    const raw = new Database(':memory:');
    const db = new SqlClientImplBunSqlite(raw);
    await db.connect();

    // Seed epoch-6 shape: durable queue + old topic applied table.
    await db.run(
      unsafe(`
      CREATE TABLE _mutations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        args TEXT NOT NULL,
        client_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        created_at TEXT NOT NULL
      )
    `)
    );
    await db.run(
      unsafe(`
      CREATE TABLE _topic_applied (
        topic TEXT PRIMARY KEY,
        last_applied TEXT NOT NULL
      )
    `)
    );
    await db.run(
      unsafe(`
      CREATE TABLE _scope_meta (
        scope_hash TEXT PRIMARY KEY,
        last_active_at TEXT NOT NULL,
        last_checkpoint TEXT,
        last_hash TEXT
      )
    `)
    );
    await db.run(sql`
      INSERT INTO _mutations (id, name, args, client_id, seq, created_at)
      VALUES ('m1', 'setNote', '{}', 'device1', 1, '2020-01-01T00:00:00.000Z')
    `);
    await db.run(sql`
      INSERT INTO _topic_applied (topic, last_applied)
      VALUES ('user:a', '42')
    `);
    // Epoch 6, migration step 1 → user_version 6001
    await db.run(unsafe('PRAGMA user_version = 6001'));

    await migrateLocalSchema(db, {
      domainSchema: emptySchema,
      cacheTableNames: [],
    });

    const mutations = await db.query(sql<{ id: string }>`
      SELECT id FROM _mutations WHERE id = 'm1'
    `);
    expect(mutations).toHaveLength(1);

    const topicApplied = await db.query(sql<{ name: string }>`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name = '_topic_applied'
    `);
    expect(topicApplied).toHaveLength(0);

    const pushApplied = await db.query(sql<{ name: string }>`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name = '_push_applied'
    `);
    expect(pushApplied).toHaveLength(1);

    const cols = await db.query(sql<{ name: string }>`
      PRAGMA table_info('_push_applied')
    `);
    expect(cols.some((c) => c.name === 'last_push_seq')).toBe(true);
  });
});
