import { afterEach, beforeEach, expect, test } from 'bun:test';
import { defineTable, registerTables, type TableDef } from '@pkgs/db-schema';
import { applySqliteSchema } from '@pkgs/db-schema/sqlite';
import { raw, type Sql, sql } from '@pkgs/sql';
import type { SqlClient } from '../../interface';

async function applySchema(
  client: SqlClient,
  tables: readonly TableDef[]
): Promise<void> {
  await applySqliteSchema(client, registerTables(tables));
}

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
    const notesTable = defineTable({
      domain: 'notes',
      name: 'notes',
      columns: { body: 'text' },
      indexes: ['body'],
    });
    await applySchema(client, [notesTable]);
    await applySchema(client, [notesTable]);

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
      { name: 'created_at', type: 'TEXT', notnull: 0, pk: 0 },
      { name: 'updated_at', type: 'TEXT', notnull: 0, pk: 0 },
      { name: 'deleted_at', type: 'TEXT', notnull: 0, pk: 0 },
      { name: 'body', type: 'TEXT', notnull: 0, pk: 0 },
    ]);

    const mapIx = (rows: { name: string; origin: string }[]) =>
      rows
        .filter((r) => !r.name.startsWith('sqlite_autoindex_'))
        .map(({ name, origin }) => ({ name, origin }));
    const ixListQ = raw<{ name: string; origin: string }>(
      'PRAGMA index_list("notes")'
    );
    const userIndexes = mapIx(await client.query(ixListQ));
    expect(userIndexes).toHaveLength(1);
    expect(userIndexes[0]?.origin).toBe('c');
    expect(userIndexes[0]?.name.startsWith('ix_notes_')).toBe(true);

    const mapIxInfo = (rows: { name: string }[]) =>
      rows.map(({ name }) => ({ name }));
    const ixInfoQ = raw<{ name: string }>(
      `PRAGMA index_info("${userIndexes[0]!.name}")`
    );
    expect(mapIxInfo(await client.query(ixInfoQ))).toEqual([{ name: 'body' }]);
  });

  test('DROP TABLE clears user indexes from catalog', async () => {
    const notesTable = defineTable({
      domain: 'notes',
      name: 'notes',
      columns: { body: 'text' },
      indexes: ['body'],
    });
    await applySchema(client, [notesTable]);
    await setup(client, [raw('DROP TABLE notes')]);
    await applySchema(client, [notesTable]);

    const userIx = (rows: { name: string; origin: string }[]) =>
      rows
        .filter((r) => !r.name.startsWith('sqlite_autoindex_'))
        .map(({ name, origin }) => ({ name, origin }));
    const ixListQ = raw<{ name: string; origin: string }>(
      'PRAGMA index_list("notes")'
    );
    const indexes = userIx(await client.query(ixListQ));
    expect(indexes).toHaveLength(1);
    expect(indexes[0]?.origin).toBe('c');
    expect(indexes[0]?.name.startsWith('ix_notes_')).toBe(true);
  });

  test('quotes reserved column names (cursor, value)', async () => {
    await applySchema(client, [
      defineTable({
        domain: 'inbox',
        name: 'inbox',
        columns: { cursor: 'text', value: 'text' },
      }),
    ]);
    await setup(client, [
      sql<void>`INSERT INTO inbox (id, cursor, value) VALUES (${'1'}, ${'c'}, ${'v'})`,
    ]);
    await expectQuery(
      client,
      raw<{ cursor: string; value: string }>('SELECT cursor, value FROM inbox'),
      [{ cursor: 'c', value: 'v' }]
    );
  });

  test('INSERT RETURNING * (IdP createUser shape)', async () => {
    await applySchema(client, [
      defineTable({
        domain: 'sample_auth_user',
        name: 'sample_auth_user',
        columns: {
          name: 'text',
          email: 'text',
          email_verified: 'integer',
        },
      }),
    ]);
    await expectQuery(
      client,
      sql<{
        id: string;
        name: string;
        email: string;
        email_verified: number;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>`insert into "sample_auth_user" ("name", "email", "email_verified", "created_at", "updated_at", "id") values (${'Ada'}, ${'ada@ex.com'}, ${0}, ${'2026-01-01'}, ${'2026-01-01'}, ${'uid1'}) returning *`,
      [
        {
          id: 'uid1',
          name: 'Ada',
          email: 'ada@ex.com',
          email_verified: 0,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
          deleted_at: null,
        },
      ]
    );
  });

  test('INSERT RETURNING partial columns', async () => {
    await applySchema(client, [
      defineTable({
        domain: 'sample_auth_user',
        name: 'sample_auth_user',
        columns: { name: 'text', email: 'text' },
      }),
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
    await applySchema(client, [
      defineTable({
        domain: 'profile',
        name: 'profile',
        columns: { username: 'text', username_norm: 'text' },
      }),
    ]);
    await setup(client, [
      sql<void>`
        INSERT INTO profile (id, username, username_norm)
        VALUES (${'u1'}, ${'old'}, ${'old'})
      `,
    ]);
    await expectQuery(
      client,
      sql<{
        id: string;
        username: string;
        username_norm: string;
        created_at: string | null;
        updated_at: string | null;
        deleted_at: string | null;
      }>`
        UPDATE profile
        SET username = ${'new_name'}, username_norm = ${'new_name'}
        WHERE id = ${'u1'}
        RETURNING *
      `,
      [
        {
          id: 'u1',
          username: 'new_name',
          username_norm: 'new_name',
          created_at: null,
          updated_at: null,
          deleted_at: null,
        },
      ]
    );
  });

  test('UPDATE RETURNING with predicate on mutated column (endSpace shape)', async () => {
    await applySchema(client, [
      defineTable({
        domain: 'spaces',
        name: 'spaces',
        columns: { ended_at: 'timestamp', host_id: 'text' },
      }),
    ]);
    await setup(client, [
      sql<void>`
        INSERT INTO spaces (id, ended_at, host_id)
        VALUES (${'s1'}, ${null}, ${'d1'})
      `,
    ]);
    const now = '2026-08-16T18:00:00.000Z';
    await expectQuery(
      client,
      sql<{
        id: string;
        ended_at: string | null;
        host_id: string;
        created_at: string | null;
        updated_at: string | null;
        deleted_at: string | null;
      }>`
        UPDATE spaces
        SET ended_at = ${now}, host_id = ${'d1'}
        WHERE id = ${'s1'} AND ended_at IS NULL
        RETURNING *
      `,
      [
        {
          id: 's1',
          ended_at: now,
          host_id: 'd1',
          created_at: null,
          updated_at: null,
          deleted_at: null,
        },
      ]
    );
  });

  test('UPDATE RETURNING soft-delete WHERE deleted_at IS NULL', async () => {
    await applySchema(client, [
      defineTable({
        domain: 'spaces',
        name: 'spaces_open_sessions',
        columns: { space_id: 'text' },
      }),
    ]);
    await setup(client, [
      sql<void>`
        INSERT INTO spaces_open_sessions (id, space_id)
        VALUES (${'sess1'}, ${'s1'})
      `,
    ]);
    const now = '2026-08-16T18:00:00.000Z';
    await expectQuery(
      client,
      sql<{
        id: string;
        space_id: string;
        deleted_at: string | null;
        created_at: string | null;
        updated_at: string | null;
      }>`
        UPDATE spaces_open_sessions
        SET deleted_at = ${now}
        WHERE space_id = ${'s1'} AND deleted_at IS NULL
        RETURNING *
      `,
      [
        {
          id: 'sess1',
          space_id: 's1',
          deleted_at: now,
          created_at: null,
          updated_at: null,
        },
      ]
    );
  });

  test('quotes primary subquery alias', async () => {
    await applySchema(client, [
      defineTable({
        domain: 'sample_auth_user',
        name: 'sample_auth_user',
        columns: { email: 'text' },
      }),
    ]);
    await setup(client, [
      sql<void>`INSERT INTO sample_auth_user (id, email) VALUES (${'u1'}, ${'a@b.co'})`,
    ]);
    await expectQuery(
      client,
      sql<{
        id: string;
        email: string;
        created_at: string | null;
        updated_at: string | null;
        deleted_at: string | null;
      }>`select "primary".* from (select * from "sample_auth_user" where "sample_auth_user"."email" = ${'a@b.co'}) as "primary"`,
      [
        {
          id: 'u1',
          email: 'a@b.co',
          created_at: null,
          updated_at: null,
          deleted_at: null,
        },
      ]
    );
  });

  test('ON CONFLICT DO UPDATE WHERE', async () => {
    await applySchema(client, [
      defineTable({
        domain: 'auth',
        name: 'auth_external_accounts',
        columns: {
          user_id: 'text',
          provider: 'text',
          external_id: 'text',
          metadata: 'text',
        },
        uniqueIndexes: [['provider', 'external_id']],
      }),
    ]);
    await setup(client, [
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
    await applySchema(client, [
      defineTable({
        domain: 'client_config',
        name: 'client_config',
        columns: { value: 'text' },
      }),
    ]);
    await setup(client, [
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
    await applySchema(client, [
      defineTable({
        domain: 'sync_engine',
        name: 'sync_engine_topic_seq',
        columns: { topic: 'text', n: 'integer' },
        uniqueIndexes: ['topic'],
      }),
    ]);
    const upsert = sql<{ n: number }>`
      INSERT INTO sync_engine_topic_seq (id, topic, n)
      VALUES (${'system:client_config'}, ${'system:client_config'}, 1)
      ON CONFLICT (topic) DO UPDATE
        SET n = sync_engine_topic_seq.n + 1
      RETURNING n
    `;
    await expectQuery(client, upsert, [{ n: 1 }]);
    await expectQuery(client, upsert, [{ n: 2 }]);
  });

  test('multi-row ON CONFLICT upsert RETURNING (allocateTopicPushSeqs)', async () => {
    await applySchema(client, [
      defineTable({
        domain: 'sync_engine',
        name: 'sync_engine_topic_seq',
        columns: { topic: 'text', n: 'integer' },
        uniqueIndexes: ['topic'],
      }),
    ]);
    const multi = sql<{ topic: string; n: number }>`
      INSERT INTO sync_engine_topic_seq (id, topic, n)
      VALUES (${'t1'}, ${'t1'}, 1), (${'t2'}, ${'t2'}, 1)
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
    await applySchema(client, [
      defineTable({
        domain: 'kv',
        name: 'kv',
        columns: { v: 'text' },
      }),
    ]);
    await setup(client, [
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
    await applySchema(client, [
      defineTable({
        domain: 'items',
        name: 'items',
        columns: { n: 'integer' },
      }),
    ]);
    await setup(client, [
      sql<void>`INSERT INTO items (id, n) VALUES (${'1'}, ${1})`,
      sql<void>`INSERT INTO items (id, n) VALUES (${'2'}, ${2})`,
      sql<void>`INSERT INTO items (id, n) VALUES (${'3'}, ${3})`,
      sql<void>`INSERT INTO items (id, n) VALUES (${'4'}, ${4})`,
      sql<void>`INSERT INTO items (id, n) VALUES (${'5'}, ${5})`,
    ]);
    await expectQuery(
      client,
      sql<{ n: number }>`
        SELECT n FROM items WHERE n > ${0} ORDER BY n LIMIT ${2} OFFSET ${1}
      `,
      [{ n: 2 }, { n: 3 }]
    );
  });

  test('nested subquery IN (SELECT …)', async () => {
    await applySchema(client, [
      defineTable({
        domain: 'spaces',
        name: 'spaces',
        columns: { host_member_id: 'text' },
      }),
      defineTable({
        domain: 'spaces',
        name: 'spaces_users',
        columns: { space_id: 'text', user_id: 'text' },
      }),
    ]);
    await setup(client, [
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
    await applySchema(client, [
      defineTable({
        domain: 'a',
        name: 'a',
        columns: { n: 'integer' },
      }),
      defineTable({
        domain: 'b',
        name: 'b',
        columns: { a_id: 'text', label: 'text' },
      }),
    ]);
    await setup(client, [
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
    await applySchema(client, [
      defineTable({
        domain: 'inbox_interactions',
        name: 'inbox_interactions',
        columns: {
          user_id: 'text',
          active: 'integer',
          read_at: 'integer',
          archived_at: 'integer',
          dismissed_at: 'integer',
        },
      }),
    ]);
    await setup(client, [
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
    await applySchema(client, [
      defineTable({
        domain: 'inbox_schema_state',
        name: 'inbox_schema_state',
        columns: { schema_fingerprint: 'text' },
      }),
    ]);
    await setup(client, [
      sql<void>`
        INSERT INTO inbox_schema_state (id, schema_fingerprint)
        VALUES (${'1'}, ${'fp-v1'})
        ON CONFLICT (id) DO UPDATE SET schema_fingerprint = EXCLUDED.schema_fingerprint
      `,
    ]);
    await expectQuery(
      client,
      raw<{ schema_fingerprint: string }>(
        `SELECT schema_fingerprint FROM inbox_schema_state WHERE id = '1'`
      ),
      [{ schema_fingerprint: 'fp-v1' }]
    );
  });

  test('transaction commit persists', async () => {
    await applySchema(client, [
      defineTable({
        domain: 'items',
        name: 'items',
        columns: { n: 'integer' },
      }),
    ]);
    await client.transaction(async (tx) => {
      await tx.run(sql<void>`INSERT INTO items (id, n) VALUES (${'1'}, ${1})`);
    });
    await expectQuery(
      client,
      raw<{ id: string }>('SELECT id FROM items ORDER BY id'),
      [{ id: '1' }]
    );
  });

  test('transaction rollback restores rows', async () => {
    await applySchema(client, [
      defineTable({
        domain: 'items',
        name: 'items',
        columns: { n: 'integer' },
      }),
    ]);
    await setup(client, [
      sql<void>`INSERT INTO items (id, n) VALUES (${'1'}, ${1})`,
    ]);
    await expect(
      client.transaction(async (tx) => {
        await tx.run(
          sql<void>`INSERT INTO items (id, n) VALUES (${'2'}, ${2})`
        );
        throw new Error('abort');
      })
    ).rejects.toThrow('abort');
    await expectQuery(
      client,
      raw<{ id: string }>('SELECT id FROM items ORDER BY id'),
      [{ id: '1' }]
    );
  });

  test('prepare + repeated query/run', async () => {
    await applySchema(client, [
      defineTable({
        domain: 'items',
        name: 'items',
        columns: { name: 'text' },
      }),
    ]);
    const insertSql = raw<Record<string, never>>(
      'INSERT INTO items (id, name) VALUES (?, ?)'
    );
    const preparedInsert = client.prepare(insertSql);
    await preparedInsert.run(['1', 'a']);
    await preparedInsert.run(['2', 'b']);

    const selectSql = sql<{ id: string; name: string }>`
      SELECT id, name FROM items WHERE id = ?
    `;
    const preparedSelect = client.prepare(selectSql);
    expect(await preparedSelect.query(['1'])).toEqual([{ id: '1', name: 'a' }]);
    expect(await preparedSelect.query(['2'])).toEqual([{ id: '2', name: 'b' }]);
  });

  test('NULL / soft-delete IS NULL filter', async () => {
    await applySchema(client, [
      defineTable({
        domain: 'domain_rows',
        name: 'domain_rows',
        columns: { body: 'text' },
      }),
    ]);
    await setup(client, [
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
    await applySchema(client, [
      defineTable({
        domain: 'items',
        name: 'items',
        columns: { v: 'text' },
      }),
    ]);
    await setup(client, [
      sql<void>`INSERT INTO items (id, v) VALUES (${'k'}, ${'v1'})`,
    ]);
    await expect(
      client.transaction(async (tx) => {
        await tx.run(
          sql<void>`INSERT INTO items (id, v) VALUES (${'k'}, ${'v2'})`
        );
      })
    ).rejects.toThrow();
    await expectQuery(
      client,
      raw<{ id: string; v: string }>('SELECT id, v FROM items'),
      [{ id: 'k', v: 'v1' }]
    );
  });

  test('UPDATE changes count matches', async () => {
    await applySchema(client, [
      defineTable({
        domain: 'counters',
        name: 'counters',
        columns: { n: 'integer' },
      }),
    ]);
    await setup(client, [
      sql<void>`INSERT INTO counters (id, n) VALUES (${'1'}, ${0})`,
      sql<void>`INSERT INTO counters (id, n) VALUES (${'2'}, ${0})`,
    ]);
    await expectRun(
      client,
      sql<void>`UPDATE counters SET n = 1 WHERE id = ${'1'}`,
      1
    );
    await expectQuery(
      client,
      raw<{ id: string; n: number }>('SELECT id, n FROM counters ORDER BY id'),
      [
        { id: '1', n: 1 },
        { id: '2', n: 0 },
      ]
    );
  });
}
