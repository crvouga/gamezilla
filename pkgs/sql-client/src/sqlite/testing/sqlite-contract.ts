import { afterEach, beforeEach, expect, test } from 'bun:test';
import { raw, type Sql, sql } from '@pkgs/sql';
import type { SqlClient } from '../../interface';

async function setup(
  client: SqlClient,
  steps: readonly Sql<unknown>[]
): Promise<void> {
  for (const step of steps) {
    await client.run(step);
  }
}

async function expectQuery<T extends Record<string, unknown>>(
  client: SqlClient,
  query: Sql<T>,
  expected: T[]
): Promise<void> {
  expect(await client.query(query)).toEqual(expected);
}

async function expectRun(
  client: SqlClient,
  query: Sql<unknown>,
  expectedChanges: number
): Promise<void> {
  const result = await client.run(query);
  expect(result.changes).toBe(expectedChanges);
}

/** Shared SQLite dialect contract — run against every in-process SqlClient adapter. */
export function runSqliteContractTests(
  factory: () => SqlClient | Promise<SqlClient>
): void {
  let client: SqlClient;

  beforeEach(async () => {
    client = await Promise.resolve(factory());
    await client.connect();
  });

  afterEach(async () => {
    try {
      await client.disconnect();
    } catch {
      // already disconnected
    }
  });

  test('PRAGMA user_version read/write', async () => {
    await expectQuery(
      client,
      raw<{ user_version: number }>('PRAGMA user_version'),
      [{ user_version: 0 }]
    );
    await setup(client, [raw('PRAGMA user_version = 9001')]);
    await expectQuery(
      client,
      raw<{ user_version: number }>('PRAGMA user_version'),
      [{ user_version: 9001 }]
    );
  });

  test('STRICT / INDEX IF NOT EXISTS / table_info / sqlite_master', async () => {
    await setup(client, [
      raw(
        'CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, body TEXT) STRICT'
      ),
      raw('CREATE INDEX IF NOT EXISTS notes_body_idx ON notes (body)'),
      raw('CREATE INDEX IF NOT EXISTS notes_body_idx ON notes (body)'),
    ]);

    await expectQuery(
      client,
      raw<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
      ),
      [{ name: 'notes' }]
    );

    const mapInfo = (
      rows: { name: string; type: string; notnull: number; pk: number }[]
    ) =>
      rows.map(({ name, type, notnull, pk }) => ({ name, type, notnull, pk }));
    const infoQ = raw<{
      name: string;
      type: string;
      notnull: number;
      pk: number;
    }>('PRAGMA table_info("notes")');
    expect(mapInfo(await client.query(infoQ))).toEqual([
      { name: 'id', type: 'TEXT', notnull: 1, pk: 1 },
      { name: 'body', type: 'TEXT', notnull: 0, pk: 0 },
    ]);

    // Native SQLite synthesizes sqlite_autoindex_* for PRIMARY KEY.
    // Compare user indexes only.
    const mapIx = (rows: { name: string; origin: string }[]) =>
      rows
        .filter((r) => !r.name.startsWith('sqlite_autoindex_'))
        .map(({ name, origin }) => ({ name, origin }));
    const ixListQ = raw<{ name: string; origin: string }>(
      'PRAGMA index_list("notes")'
    );
    expect(mapIx(await client.query(ixListQ))).toEqual([
      { name: 'notes_body_idx', origin: 'c' },
    ]);

    const mapIxInfo = (rows: { name: string }[]) =>
      rows.map(({ name }) => ({ name }));
    const ixInfoQ = raw<{ name: string }>(
      'PRAGMA index_info("notes_body_idx")'
    );
    expect(mapIxInfo(await client.query(ixInfoQ))).toEqual([{ name: 'body' }]);
  });

  test('DROP TABLE clears user indexes from catalog', async () => {
    await setup(client, [
      raw('CREATE TABLE notes (id TEXT PRIMARY KEY, body TEXT) STRICT'),
      raw('CREATE INDEX IF NOT EXISTS notes_body_idx ON notes (body)'),
      raw('DROP TABLE notes'),
      raw('CREATE TABLE notes (id TEXT PRIMARY KEY, body TEXT) STRICT'),
    ]);
    const userIx = (rows: { name: string }[]) =>
      rows
        .filter((r) => !r.name.startsWith('sqlite_autoindex_'))
        .map(({ name }) => ({ name }));
    const ixListQ = raw<{ name: string }>('PRAGMA index_list("notes")');
    expect(userIx(await client.query(ixListQ))).toEqual([]);
  });

  test('quotes reserved column names (cursor, value)', async () => {
    await setup(client, [
      raw(
        'CREATE TABLE IF NOT EXISTS inbox (id TEXT PRIMARY KEY, cursor TEXT, value TEXT) STRICT'
      ),
      sql<void>`INSERT INTO inbox (id, cursor, value) VALUES (${'1'}, ${'c'}, ${'v'})`,
    ]);
    await expectQuery(
      client,
      raw<{ cursor: string; value: string }>('SELECT cursor, value FROM inbox'),
      [{ cursor: 'c', value: 'v' }]
    );
  });

  test('INSERT RETURNING * (IdP createUser shape)', async () => {
    await setup(client, [
      raw(
        'CREATE TABLE sample_auth_user (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, emailVerified INTEGER NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL)'
      ),
    ]);
    await expectQuery(
      client,
      sql<{
        id: string;
        name: string;
        email: string;
        emailVerified: number;
        createdAt: string;
        updatedAt: string;
      }>`insert into "sample_auth_user" ("name", "email", "emailVerified", "createdAt", "updatedAt", "id") values (${'Ada'}, ${'ada@ex.com'}, ${0}, ${'2026-01-01'}, ${'2026-01-01'}, ${'uid1'}) returning *`,
      [
        {
          id: 'uid1',
          name: 'Ada',
          email: 'ada@ex.com',
          emailVerified: 0,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ]
    );
  });

  test('INSERT RETURNING partial columns', async () => {
    await setup(client, [
      raw(
        'CREATE TABLE sample_auth_user (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL)'
      ),
    ]);
    await expectQuery(
      client,
      sql<{ id: string; email: string }>`
        INSERT INTO sample_auth_user (id, name, email)
        VALUES (${'u1'}, ${'Ada'}, ${'a@b.co'})
        RETURNING id, email
      `,
      [{ id: 'u1', email: 'a@b.co' }]
    );
  });

  test('UPDATE RETURNING * (mutation write-capture shape)', async () => {
    await setup(client, [
      raw(
        'CREATE TABLE profile (id TEXT PRIMARY KEY, username TEXT NOT NULL, username_norm TEXT NOT NULL)'
      ),
      sql<void>`
        INSERT INTO profile (id, username, username_norm)
        VALUES (${'u1'}, ${'old'}, ${'old'})
      `,
    ]);
    await expectQuery(
      client,
      sql<{ id: string; username: string; username_norm: string }>`
        UPDATE profile
        SET username = ${'new_name'}, username_norm = ${'new_name'}
        WHERE id = ${'u1'}
        RETURNING *
      `,
      [{ id: 'u1', username: 'new_name', username_norm: 'new_name' }]
    );
  });

  test('UPDATE RETURNING with predicate on mutated column (endSpace shape)', async () => {
    await setup(client, [
      raw(
        'CREATE TABLE spaces (id TEXT PRIMARY KEY, ended_at TEXT, host_id TEXT)'
      ),
      sql<void>`
        INSERT INTO spaces (id, ended_at, host_id)
        VALUES (${'s1'}, ${null}, ${'d1'})
      `,
    ]);
    const now = '2026-08-16T18:00:00.000Z';
    await expectQuery(
      client,
      sql<{ id: string; ended_at: string | null; host_id: string }>`
        UPDATE spaces
        SET ended_at = ${now}, host_id = ${'d1'}
        WHERE id = ${'s1'} AND ended_at IS NULL
        RETURNING *
      `,
      [{ id: 's1', ended_at: now, host_id: 'd1' }]
    );
  });

  test('UPDATE RETURNING soft-delete WHERE deleted_at IS NULL', async () => {
    await setup(client, [
      raw(
        'CREATE TABLE spaces_open_sessions (id TEXT PRIMARY KEY, space_id TEXT, deleted_at TEXT)'
      ),
      sql<void>`
        INSERT INTO spaces_open_sessions (id, space_id, deleted_at)
        VALUES (${'sess1'}, ${'s1'}, ${null})
      `,
    ]);
    const now = '2026-08-16T18:00:00.000Z';
    await expectQuery(
      client,
      sql<{ id: string; space_id: string; deleted_at: string | null }>`
        UPDATE spaces_open_sessions
        SET deleted_at = ${now}
        WHERE space_id = ${'s1'} AND deleted_at IS NULL
        RETURNING *
      `,
      [{ id: 'sess1', space_id: 's1', deleted_at: now }]
    );
  });

  test('quotes primary subquery alias', async () => {
    await setup(client, [
      raw(
        'CREATE TABLE sample_auth_user (id TEXT PRIMARY KEY, email TEXT NOT NULL)'
      ),
      sql<void>`INSERT INTO sample_auth_user (id, email) VALUES (${'u1'}, ${'a@b.co'})`,
    ]);
    await expectQuery(
      client,
      sql<{
        id: string;
        email: string;
      }>`select "primary".* from (select * from "sample_auth_user" where "sample_auth_user"."email" = ${'a@b.co'}) as "primary"`,
      [{ id: 'u1', email: 'a@b.co' }]
    );
  });

  test('ON CONFLICT DO UPDATE WHERE', async () => {
    await setup(client, [
      raw(`
        CREATE TABLE auth_external_accounts (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          external_id TEXT NOT NULL,
          metadata TEXT,
          updated_at TEXT,
          UNIQUE (provider, external_id)
        )
      `),
      sql<void>`
        INSERT INTO auth_external_accounts (
          id, user_id, provider, external_id, metadata, updated_at
        ) VALUES (
          ${'idp:ext1'}, ${'user-a'}, ${'idp'}, ${'ext1'},
          ${'{}'}, ${'t0'}
        )
      `,
      sql<void>`
        INSERT INTO auth_external_accounts (
          id, user_id, provider, external_id, metadata, updated_at
        )
        VALUES (
          ${'idp:ext1'}, ${'user-a'}, ${'idp'}, ${'ext1'},
          ${'{"email":"a@b.co"}'}, ${'t1'}
        )
        ON CONFLICT (provider, external_id) DO UPDATE SET
          metadata = excluded.metadata,
          updated_at = excluded.updated_at
        WHERE auth_external_accounts.user_id = excluded.user_id
      `,
    ]);
    await expectQuery(
      client,
      raw<{ metadata: string; updated_at: string }>(
        'SELECT metadata, updated_at FROM auth_external_accounts'
      ),
      [{ metadata: '{"email":"a@b.co"}', updated_at: 't1' }]
    );
  });

  test('ON CONFLICT DO UPDATE with reserved col value', async () => {
    await setup(client, [
      raw(`
        CREATE TABLE client_config (
          id TEXT PRIMARY KEY,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          value TEXT NOT NULL
        )
      `),
      sql<void>`
        INSERT INTO client_config (id, created_at, updated_at, deleted_at, value)
        VALUES (${'k'}, ${'t0'}, ${'t0'}, NULL, ${'"old"'})
      `,
      sql<void>`
        INSERT INTO client_config (id, created_at, updated_at, deleted_at, value)
        VALUES (${'k'}, ${'t1'}, ${'t1'}, NULL, ${'"new"'})
        ON CONFLICT (id) DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = EXCLUDED.updated_at,
          deleted_at = NULL
      `,
    ]);
    await expectQuery(
      client,
      raw<{ value: string; updated_at: string }>(
        'SELECT value, updated_at FROM client_config'
      ),
      [{ value: '"new"', updated_at: 't1' }]
    );
  });

  test('ON CONFLICT upsert increments and RETURNING', async () => {
    await setup(client, [
      raw(
        'CREATE TABLE sync_engine_topic_seq (topic TEXT PRIMARY KEY, n INTEGER NOT NULL)'
      ),
    ]);
    const upsert = sql<{ n: number }>`
      INSERT INTO sync_engine_topic_seq (topic, n)
      VALUES (${'system:client_config'}, 1)
      ON CONFLICT (topic) DO UPDATE
        SET n = sync_engine_topic_seq.n + 1
      RETURNING n
    `;
    await expectQuery(client, upsert, [{ n: 1 }]);
    await expectQuery(client, upsert, [{ n: 2 }]);
  });

  test('multi-row ON CONFLICT upsert RETURNING (allocateTopicPushSeqs)', async () => {
    await setup(client, [
      raw(
        'CREATE TABLE sync_engine_topic_seq (topic TEXT PRIMARY KEY, n INTEGER NOT NULL)'
      ),
    ]);
    const multi = sql<{ topic: string; n: number }>`
      INSERT INTO sync_engine_topic_seq (topic, n)
      VALUES (${'t1'}, 1), (${'t2'}, 1)
      ON CONFLICT (topic) DO UPDATE
        SET n = sync_engine_topic_seq.n + 1
      RETURNING topic, n
    `;
    await expectQuery(client, multi, [
      { topic: 't1', n: 1 },
      { topic: 't2', n: 1 },
    ]);
    await expectQuery(client, multi, [
      { topic: 't1', n: 2 },
      { topic: 't2', n: 2 },
    ]);
  });

  test('ON CONFLICT DO NOTHING leaves existing row', async () => {
    await setup(client, [
      raw('CREATE TABLE kv (id TEXT PRIMARY KEY, v TEXT NOT NULL)'),
      sql<void>`INSERT INTO kv (id, v) VALUES (${'k'}, ${'old'})`,
      sql<void>`
        INSERT INTO kv (id, v) VALUES (${'k'}, ${'new'})
        ON CONFLICT (id) DO NOTHING
      `,
    ]);
    await expectQuery(
      client,
      raw<{ id: string; v: string }>('SELECT id, v FROM kv'),
      [{ id: 'k', v: 'old' }]
    );
  });

  test('parameterized LIMIT / OFFSET', async () => {
    await setup(client, [
      raw('CREATE TABLE t (id INTEGER PRIMARY KEY)'),
      sql<void>`INSERT INTO t (id) VALUES (${1})`,
      sql<void>`INSERT INTO t (id) VALUES (${2})`,
      sql<void>`INSERT INTO t (id) VALUES (${3})`,
      sql<void>`INSERT INTO t (id) VALUES (${4})`,
      sql<void>`INSERT INTO t (id) VALUES (${5})`,
    ]);
    await expectQuery(
      client,
      sql<{ id: number }>`
        SELECT id FROM t WHERE id > ${0} ORDER BY id LIMIT ${2} OFFSET ${1}
      `,
      [{ id: 2 }, { id: 3 }]
    );
  });

  test('nested subquery IN (SELECT …)', async () => {
    await setup(client, [
      raw('CREATE TABLE spaces (id TEXT, host_member_id TEXT)'),
      raw('CREATE TABLE spaces_users (id TEXT, space_id TEXT, user_id TEXT)'),
      sql<void>`INSERT INTO spaces (id, host_member_id) VALUES (${'s1'}, ${'u'})`,
      sql<void>`INSERT INTO spaces_users (id, space_id, user_id) VALUES (${'su1'}, ${'s1'}, ${'u2'})`,
    ]);
    await expectQuery(
      client,
      sql<{ id: string }>`
        SELECT id FROM spaces_users
        WHERE space_id IN (
          SELECT id FROM spaces WHERE host_member_id = ${'u'}
        )
      `,
      [{ id: 'su1' }]
    );
  });

  test('join + ORDER BY', async () => {
    await setup(client, [
      raw('CREATE TABLE a (id TEXT PRIMARY KEY, n INTEGER)'),
      raw('CREATE TABLE b (id TEXT PRIMARY KEY, a_id TEXT, label TEXT)'),
      sql<void>`INSERT INTO a (id, n) VALUES (${'a1'}, ${1})`,
      sql<void>`INSERT INTO a (id, n) VALUES (${'a2'}, ${2})`,
      sql<void>`INSERT INTO b (id, a_id, label) VALUES (${'b1'}, ${'a1'}, ${'x'})`,
      sql<void>`INSERT INTO b (id, a_id, label) VALUES (${'b2'}, ${'a2'}, ${'y'})`,
    ]);
    await expectQuery(
      client,
      sql<{ id: string; label: string; n: number }>`
        SELECT b.id, b.label, a.n
          FROM b
          JOIN a ON a.id = b.a_id
         ORDER BY a.n DESC
      `,
      [
        { id: 'b2', label: 'y', n: 2 },
        { id: 'b1', label: 'x', n: 1 },
      ]
    );
  });

  test('COUNT(*) AS count', async () => {
    await setup(client, [
      raw(
        'CREATE TABLE inbox_interactions (id TEXT, user_id TEXT, active INT, read_at INT, archived_at INT, dismissed_at INT)'
      ),
      sql<void>`INSERT INTO inbox_interactions (id, user_id, active) VALUES (${'1'}, ${'u'}, ${1})`,
    ]);
    await expectQuery(
      client,
      sql<{ count: number }>`
        SELECT COUNT(*) AS count
          FROM inbox_interactions
         WHERE user_id = ${'u'}
           AND active IS TRUE
           AND read_at IS NULL
      `,
      [{ count: 1 }]
    );
  });

  test('schema_ prefix columns + ON CONFLICT', async () => {
    await setup(client, [
      raw(
        'CREATE TABLE inbox_schema_state (id INT PRIMARY KEY, schema_fingerprint TEXT NOT NULL)'
      ),
      sql<void>`
        INSERT INTO inbox_schema_state (id, schema_fingerprint)
        VALUES (1, ${'fp-v1'})
        ON CONFLICT (id) DO UPDATE SET schema_fingerprint = EXCLUDED.schema_fingerprint
      `,
    ]);
    await expectQuery(
      client,
      raw<{ schema_fingerprint: string }>(
        'SELECT schema_fingerprint FROM inbox_schema_state WHERE id = 1'
      ),
      [{ schema_fingerprint: 'fp-v1' }]
    );
  });

  test('transaction commit persists', async () => {
    await setup(client, [raw('CREATE TABLE items (id INTEGER PRIMARY KEY)')]);
    await client.transaction(async (tx) => {
      await tx.run(sql<void>`INSERT INTO items (id) VALUES (${1})`);
    });
    await expectQuery(
      client,
      raw<{ id: number }>('SELECT id FROM items ORDER BY id'),
      [{ id: 1 }]
    );
  });

  test('transaction rollback restores rows', async () => {
    await setup(client, [
      raw('CREATE TABLE items (id INTEGER PRIMARY KEY)'),
      sql<void>`INSERT INTO items (id) VALUES (${1})`,
    ]);
    await expect(
      client.transaction(async (tx) => {
        await tx.run(sql<void>`INSERT INTO items (id) VALUES (${2})`);
        throw new Error('abort');
      })
    ).rejects.toThrow('abort');
    await expectQuery(
      client,
      raw<{ id: number }>('SELECT id FROM items ORDER BY id'),
      [{ id: 1 }]
    );
  });

  test('prepare + repeated query/run', async () => {
    await setup(client, [
      raw('CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)'),
    ]);
    const insertSql = raw<Record<string, never>>(
      'INSERT INTO t (id, name) VALUES (?, ?)'
    );
    const preparedInsert = client.prepare(insertSql);
    await preparedInsert.run([1, 'a']);
    await preparedInsert.run([2, 'b']);

    const selectSql = sql<{ id: number; name: string }>`
      SELECT id, name FROM t WHERE id = ?
    `;
    const preparedSelect = client.prepare(selectSql);
    expect(await preparedSelect.query([1])).toEqual([{ id: 1, name: 'a' }]);
    expect(await preparedSelect.query([2])).toEqual([{ id: 2, name: 'b' }]);
  });

  test('NULL / soft-delete IS NULL filter', async () => {
    await setup(client, [
      raw(
        'CREATE TABLE domain_rows (id TEXT PRIMARY KEY, deleted_at TEXT, body TEXT)'
      ),
      sql<void>`INSERT INTO domain_rows (id, deleted_at, body) VALUES (${'alive'}, NULL, ${'a'})`,
      sql<void>`INSERT INTO domain_rows (id, deleted_at, body) VALUES (${'gone'}, ${'t1'}, ${'b'})`,
    ]);
    await expectQuery(
      client,
      sql<{ id: string; body: string }>`
        SELECT id, body FROM domain_rows WHERE deleted_at IS NULL ORDER BY id
      `,
      [{ id: 'alive', body: 'a' }]
    );
    await expectRun(
      client,
      sql<void>`UPDATE domain_rows SET deleted_at = ${'t2'} WHERE id = ${'alive'}`,
      1
    );
    await expectQuery(
      client,
      raw<{ id: string }>(
        'SELECT id FROM domain_rows WHERE deleted_at IS NULL'
      ),
      []
    );
  });

  test('UNIQUE conflict in transaction leaves prior state', async () => {
    await setup(client, [
      raw('CREATE TABLE t (id TEXT PRIMARY KEY, v TEXT)'),
      sql<void>`INSERT INTO t (id, v) VALUES (${'k'}, ${'v1'})`,
    ]);
    await expect(
      client.transaction(async (tx) => {
        await tx.run(sql<void>`INSERT INTO t (id, v) VALUES (${'k'}, ${'v2'})`);
      })
    ).rejects.toThrow();
    await expectQuery(
      client,
      raw<{ id: string; v: string }>('SELECT id, v FROM t'),
      [{ id: 'k', v: 'v1' }]
    );
  });

  test('UPDATE changes count matches', async () => {
    await setup(client, [
      raw('CREATE TABLE counters (id INTEGER, n INTEGER)'),
      raw('INSERT INTO counters VALUES (1, 0)'),
      raw('INSERT INTO counters VALUES (2, 0)'),
    ]);
    await expectRun(
      client,
      sql<void>`UPDATE counters SET n = 1 WHERE id = ${1}`,
      1
    );
    await expectQuery(
      client,
      raw<{ id: number; n: number }>('SELECT id, n FROM counters ORDER BY id'),
      [
        { id: 1, n: 1 },
        { id: 2, n: 0 },
      ]
    );
  });
}
