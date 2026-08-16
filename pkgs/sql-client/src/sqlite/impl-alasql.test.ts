import { afterEach, describe, expect, test } from 'bun:test';
import { raw, sql } from '@pkgs/sql';
import { SqlClientImplAlaSql } from './impl-alasql';

describe('SqlClientImplAlaSql', () => {
  const openClients: SqlClientImplAlaSql[] = [];

  afterEach(async () => {
    while (openClients.length > 0) {
      const client = openClients.pop();
      if (client) await client.disconnect();
    }
  });

  async function open(name: string): Promise<SqlClientImplAlaSql> {
    const client = SqlClientImplAlaSql.open(name);
    await client.connect();
    openClients.push(client);
    return client;
  }

  test('named databases are isolated', async () => {
    const alice = await open('unit_alasql_alice');
    const bob = await open('unit_alasql_bob');
    await alice.run(raw('CREATE TABLE t (id INTEGER, name TEXT)'));
    await bob.run(raw('CREATE TABLE t (id INTEGER, name TEXT)'));
    await alice.run(sql<void>`INSERT INTO t VALUES (${1}, ${'alice'})`);
    await bob.run(sql<void>`INSERT INTO t VALUES (${1}, ${'bob'})`);
    const aliceRows = await alice.query(
      raw<{ id: number; name: string }>('SELECT * FROM t')
    );
    const bobRows = await bob.query(
      raw<{ id: number; name: string }>('SELECT * FROM t')
    );
    expect(aliceRows).toEqual([{ id: 1, name: 'alice' }]);
    expect(bobRows).toEqual([{ id: 1, name: 'bob' }]);
  });

  test('transaction rollback restores rows', async () => {
    const client = await open('unit_alasql_tx');
    await client.run(raw('CREATE TABLE items (id INTEGER PRIMARY KEY)'));
    await client.run(sql<void>`INSERT INTO items (id) VALUES (${1})`);
    await expect(
      client.transaction(async (tx) => {
        await tx.run(sql<void>`INSERT INTO items (id) VALUES (${2})`);
        throw new Error('abort');
      })
    ).rejects.toThrow('abort');
    const rows = await client.query(
      raw<{ id: number }>('SELECT id FROM items ORDER BY id')
    );
    expect(rows).toEqual([{ id: 1 }]);
  });

  test('disconnect drops named database for clean reopen', async () => {
    const first = SqlClientImplAlaSql.open('unit_alasql_reopen');
    await first.connect();
    await first.run(raw('CREATE TABLE t (id INTEGER)'));
    await first.run(sql<void>`INSERT INTO t VALUES (${1})`);
    await first.disconnect();

    const second = await open('unit_alasql_reopen');
    await second.run(raw('CREATE TABLE t (id INTEGER)'));
    const rows = await second.query(raw<{ id: number }>('SELECT * FROM t'));
    expect(rows).toEqual([]);
  });

  test('PRAGMA user_version read/write', async () => {
    const client = await open('unit_alasql_user_version');
    const before = await client.query(
      raw<{ user_version: number }>('PRAGMA user_version')
    );
    expect(before).toEqual([{ user_version: 0 }]);
    await client.run(raw('PRAGMA user_version = 9001'));
    const after = await client.query(
      raw<{ user_version: number }>('PRAGMA user_version')
    );
    expect(after).toEqual([{ user_version: 9001 }]);
  });

  test('sqlite STRICT / INDEX IF NOT EXISTS / table_info / sqlite_master', async () => {
    const client = await open('unit_alasql_catalog');
    await client.run(
      raw(
        'CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, body TEXT) STRICT'
      )
    );
    await client.run(
      raw('CREATE INDEX IF NOT EXISTS notes_body_idx ON notes (body)')
    );
    // Idempotent second create
    await client.run(
      raw('CREATE INDEX IF NOT EXISTS notes_body_idx ON notes (body)')
    );

    const master = await client.query<{ name: string }>(
      raw(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
      )
    );
    expect(master).toEqual([{ name: 'notes' }]);

    const info = await client.query<{
      name: string;
      type: string;
      notnull: number;
      pk: number;
    }>(raw('PRAGMA table_info("notes")'));
    expect(
      info.map(({ name, type, notnull, pk }) => ({ name, type, notnull, pk }))
    ).toEqual([
      { name: 'id', type: 'TEXT', notnull: 1, pk: 1 },
      { name: 'body', type: 'TEXT', notnull: 0, pk: 0 },
    ]);

    const ixList = await client.query<{ name: string; origin: string }>(
      raw('PRAGMA index_list("notes")')
    );
    expect(ixList.map(({ name, origin }) => ({ name, origin }))).toEqual([
      { name: 'notes_body_idx', origin: 'c' },
    ]);

    const ixInfo = await client.query<{ name: string }>(
      raw('PRAGMA index_info("notes_body_idx")')
    );
    expect(ixInfo.map(({ name }) => ({ name }))).toEqual([{ name: 'body' }]);
  });

  test('quotes AlaSQL-reserved column names (cursor, value)', async () => {
    const client = await open('unit_alasql_reserved');
    await client.run(
      raw(
        'CREATE TABLE IF NOT EXISTS inbox (id TEXT PRIMARY KEY, cursor TEXT, value TEXT) STRICT'
      )
    );
    await client.run(
      sql<void>`INSERT INTO inbox (id, cursor, value) VALUES (${'1'}, ${'c'}, ${'v'})`
    );
    const rows = await client.query<{ cursor: string; value: string }>(
      raw('SELECT cursor, value FROM inbox')
    );
    expect(rows).toEqual([{ cursor: 'c', value: 'v' }]);
  });

  test('ON CONFLICT upsert increments and RETURNING', async () => {
    const client = await open('unit_alasql_upsert');
    await client.run(
      raw(
        'CREATE TABLE sync_engine_topic_seq (topic TEXT PRIMARY KEY, n INTEGER NOT NULL)'
      )
    );
    const first = await client.query(
      sql<{ n: number }>`
        INSERT INTO sync_engine_topic_seq (topic, n)
        VALUES (${'system:client_config'}, 1)
        ON CONFLICT (topic) DO UPDATE
          SET n = sync_engine_topic_seq.n + 1
        RETURNING n
      `
    );
    expect(first).toEqual([{ n: 1 }]);
    const second = await client.query(
      sql<{ n: number }>`
        INSERT INTO sync_engine_topic_seq (topic, n)
        VALUES (${'system:client_config'}, 1)
        ON CONFLICT (topic) DO UPDATE
          SET n = sync_engine_topic_seq.n + 1
        RETURNING n
      `
    );
    expect(second).toEqual([{ n: 2 }]);
  });

  test('inlines parameterized LIMIT / OFFSET (AlaSQL rejects LIMIT ?)', async () => {
    const client = await open('unit_alasql_limit');
    await client.run(raw('CREATE TABLE t (id INTEGER PRIMARY KEY)'));
    for (const id of [1, 2, 3, 4, 5]) {
      await client.run(sql<void>`INSERT INTO t (id) VALUES (${id})`);
    }
    const page = await client.query(
      sql<{ id: number }>`
        SELECT id FROM t WHERE id > ${0} ORDER BY id LIMIT ${2} OFFSET ${1}
      `
    );
    expect(page).toEqual([{ id: 2 }, { id: 3 }]);
  });

  test('nested subquery OK; WITH CTE cannot see base tables', async () => {
    const client = await open('unit_alasql_cte');
    await client.run(raw('CREATE TABLE spaces (id TEXT, host_member_id TEXT)'));
    await client.run(
      raw('CREATE TABLE spaces_users (id TEXT, space_id TEXT, user_id TEXT)')
    );
    expect(() => {
      void client.query(sql<{ id: string }>`
        WITH related AS (
          SELECT id FROM spaces WHERE host_member_id = ${'u'}
        )
        SELECT id FROM spaces_users WHERE space_id IN (SELECT id FROM related)
      `);
    }).toThrow(/Table does not exist/);
    const rows = await client.query(sql<{ id: string }>`
      SELECT id FROM spaces_users
      WHERE space_id IN (
        SELECT id FROM spaces WHERE host_member_id = ${'u'}
      )
    `);
    expect(rows).toEqual([]);
  });

  test('quotes AS count alias without breaking COUNT(*)', async () => {
    const client = await open('unit_alasql_count_alias');
    await client.run(
      raw(
        'CREATE TABLE inbox_interactions (id TEXT, user_id TEXT, active INT, read_at INT, archived_at INT, dismissed_at INT)'
      )
    );
    await client.run(
      sql<void>`INSERT INTO inbox_interactions (id, user_id, active) VALUES (${'1'}, ${'u'}, ${1})`
    );
    const rows = await client.query(
      sql<{ count: number }>`
        SELECT COUNT(*) AS count
          FROM inbox_interactions
         WHERE user_id = ${'u'}
           AND active = ${1}
           AND read_at IS NULL
      `
    );
    expect(rows).toEqual([{ count: 1 }]);
  });

  test('quotes schema_ prefix columns for inbox fingerprint', async () => {
    const client = await open('unit_alasql_schema_prefix');
    await client.run(
      raw(
        'CREATE TABLE inbox_schema_state (id INT PRIMARY KEY, schema_fingerprint TEXT NOT NULL)'
      )
    );
    await client.run(
      sql<void>`
        INSERT INTO inbox_schema_state (id, schema_fingerprint)
        VALUES (1, ${'fp-v1'})
        ON CONFLICT (id) DO UPDATE SET schema_fingerprint = EXCLUDED.schema_fingerprint
      `
    );
    const rows = await client.query(
      raw<{ schema_fingerprint: string }>(
        'SELECT schema_fingerprint FROM inbox_schema_state WHERE id = 1'
      )
    );
    expect(rows).toEqual([{ schema_fingerprint: 'fp-v1' }]);
  });
});
