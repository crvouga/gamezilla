import { afterEach, describe, expect, test } from 'bun:test';
import { raw, type Sql, sql } from '@pkgs/sql';
import type { SqlClient } from '../interface';
import { SqlClientImplAlaSql } from './impl-alasql';
import { SqlClientImplBunSqlite } from './impl-bun-sqlite';

type Pair = {
  readonly alasql: SqlClient;
  readonly sqlite: SqlClient;
};

let pairSeq = 0;
const openPairs: Pair[] = [];
const openAlaOnly: SqlClientImplAlaSql[] = [];

afterEach(async () => {
  while (openPairs.length > 0) {
    const pair = openPairs.pop();
    if (!pair) continue;
    try {
      await pair.alasql.disconnect();
    } catch {
      // already disconnected
    }
    try {
      await pair.sqlite.disconnect();
    } catch {
      // already disconnected
    }
  }
  while (openAlaOnly.length > 0) {
    const client = openAlaOnly.pop();
    if (client) await client.disconnect();
  }
});

async function openPair(): Promise<Pair> {
  pairSeq += 1;
  const alasql = SqlClientImplAlaSql.open(`unit_alasql_eq_${pairSeq}`);
  await alasql.connect();
  const sqlite = SqlClientImplBunSqlite.open(':memory:');
  await sqlite.connect();
  const pair = { alasql, sqlite };
  openPairs.push(pair);
  return pair;
}

async function openAla(name: string): Promise<SqlClientImplAlaSql> {
  const client = SqlClientImplAlaSql.open(name);
  await client.connect();
  openAlaOnly.push(client);
  return client;
}

async function setupBoth(
  pair: Pair,
  steps: readonly Sql<unknown>[]
): Promise<void> {
  for (const step of steps) {
    await pair.alasql.run(step);
    await pair.sqlite.run(step);
  }
}

async function expectQueryEqual<T extends Record<string, unknown>>(
  pair: Pair,
  query: Sql<T>
): Promise<T[]> {
  const alasqlRows = await pair.alasql.query(query);
  const sqliteRows = await pair.sqlite.query(query);
  expect(alasqlRows).toEqual(sqliteRows);
  return alasqlRows;
}

async function expectRunEqual(
  pair: Pair,
  query: Sql<unknown>
): Promise<{ changes: number }> {
  const a = await pair.alasql.run(query);
  const s = await pair.sqlite.run(query);
  expect(a.changes).toBe(s.changes);
  return { changes: a.changes };
}

describe('AlaSQL ≡ Bun SQLite', () => {
  test('PRAGMA user_version read/write', async () => {
    const pair = await openPair();
    await expectQueryEqual(
      pair,
      raw<{ user_version: number }>('PRAGMA user_version')
    );
    await setupBoth(pair, [raw('PRAGMA user_version = 9001')]);
    await expectQueryEqual(
      pair,
      raw<{ user_version: number }>('PRAGMA user_version')
    );
  });

  test('STRICT / INDEX IF NOT EXISTS / table_info / sqlite_master', async () => {
    const pair = await openPair();
    await setupBoth(pair, [
      raw(
        'CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, body TEXT) STRICT'
      ),
      raw('CREATE INDEX IF NOT EXISTS notes_body_idx ON notes (body)'),
      raw('CREATE INDEX IF NOT EXISTS notes_body_idx ON notes (body)'),
    ]);

    await expectQueryEqual(
      pair,
      raw<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
      )
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
    expect(mapInfo(await pair.alasql.query(infoQ))).toEqual(
      mapInfo(await pair.sqlite.query(infoQ))
    );

    // Bun synthesizes sqlite_autoindex_* for PRIMARY KEY; AlaSQL tracks
    // explicit CREATE INDEX only. Compare user indexes.
    const mapIx = (rows: { name: string; origin: string }[]) =>
      rows
        .filter((r) => !r.name.startsWith('sqlite_autoindex_'))
        .map(({ name, origin }) => ({ name, origin }));
    const ixListQ = raw<{ name: string; origin: string }>(
      'PRAGMA index_list("notes")'
    );
    expect(mapIx(await pair.alasql.query(ixListQ))).toEqual(
      mapIx(await pair.sqlite.query(ixListQ))
    );

    const mapIxInfo = (rows: { name: string }[]) =>
      rows.map(({ name }) => ({ name }));
    const ixInfoQ = raw<{ name: string }>(
      'PRAGMA index_info("notes_body_idx")'
    );
    expect(mapIxInfo(await pair.alasql.query(ixInfoQ))).toEqual(
      mapIxInfo(await pair.sqlite.query(ixInfoQ))
    );
  });

  test('DROP TABLE clears user indexes from catalog', async () => {
    const pair = await openPair();
    await setupBoth(pair, [
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
    expect(userIx(await pair.alasql.query(ixListQ))).toEqual(
      userIx(await pair.sqlite.query(ixListQ))
    );
  });

  test('quotes reserved column names (cursor, value)', async () => {
    const pair = await openPair();
    await setupBoth(pair, [
      raw(
        'CREATE TABLE IF NOT EXISTS inbox (id TEXT PRIMARY KEY, cursor TEXT, value TEXT) STRICT'
      ),
      sql<void>`INSERT INTO inbox (id, cursor, value) VALUES (${'1'}, ${'c'}, ${'v'})`,
    ]);
    await expectQueryEqual(
      pair,
      raw<{ cursor: string; value: string }>('SELECT cursor, value FROM inbox')
    );
  });

  test('INSERT RETURNING * (better-auth createUser shape)', async () => {
    const pair = await openPair();
    await setupBoth(pair, [
      raw(
        'CREATE TABLE better_auth_user (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, emailVerified INTEGER NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL)'
      ),
    ]);
    await expectQueryEqual(
      pair,
      sql<{
        id: string;
        name: string;
        email: string;
        emailVerified: number;
        createdAt: string;
        updatedAt: string;
      }>`insert into "better_auth_user" ("name", "email", "emailVerified", "createdAt", "updatedAt", "id") values (${'Ada'}, ${'ada@ex.com'}, ${0}, ${'2026-01-01'}, ${'2026-01-01'}, ${'uid1'}) returning *`
    );
  });

  test('INSERT RETURNING partial columns', async () => {
    const pair = await openPair();
    await setupBoth(pair, [
      raw(
        'CREATE TABLE better_auth_user (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL)'
      ),
    ]);
    await expectQueryEqual(
      pair,
      sql<{ id: string; email: string }>`
        INSERT INTO better_auth_user (id, name, email)
        VALUES (${'u1'}, ${'Ada'}, ${'a@b.co'})
        RETURNING id, email
      `
    );
  });

  test('UPDATE RETURNING * (mutation write-capture shape)', async () => {
    const pair = await openPair();
    await setupBoth(pair, [
      raw(
        'CREATE TABLE profile (id TEXT PRIMARY KEY, username TEXT NOT NULL, username_norm TEXT NOT NULL)'
      ),
      sql<void>`
        INSERT INTO profile (id, username, username_norm)
        VALUES (${'u1'}, ${'old'}, ${'old'})
      `,
    ]);
    await expectQueryEqual(
      pair,
      sql<{ id: string; username: string; username_norm: string }>`
        UPDATE profile
        SET username = ${'new_name'}, username_norm = ${'new_name'}
        WHERE id = ${'u1'}
        RETURNING *
      `
    );
  });

  test('UPDATE RETURNING with predicate on mutated column (endSpace shape)', async () => {
    const pair = await openPair();
    await setupBoth(pair, [
      raw(
        'CREATE TABLE spaces (id TEXT PRIMARY KEY, ended_at TEXT, host_id TEXT)'
      ),
      sql<void>`
        INSERT INTO spaces (id, ended_at, host_id)
        VALUES (${'s1'}, ${null}, ${'d1'})
      `,
    ]);
    const now = '2026-08-16T18:00:00.000Z';
    await expectQueryEqual(
      pair,
      sql<{ id: string; ended_at: string | null; host_id: string }>`
        UPDATE spaces
        SET ended_at = ${now}, host_id = ${'d1'}
        WHERE id = ${'s1'} AND ended_at IS NULL
        RETURNING *
      `
    );
  });

  test('UPDATE RETURNING soft-delete WHERE deleted_at IS NULL', async () => {
    const pair = await openPair();
    await setupBoth(pair, [
      raw(
        'CREATE TABLE spaces_open_sessions (id TEXT PRIMARY KEY, space_id TEXT, deleted_at TEXT)'
      ),
      sql<void>`
        INSERT INTO spaces_open_sessions (id, space_id, deleted_at)
        VALUES (${'sess1'}, ${'s1'}, ${null})
      `,
    ]);
    const now = '2026-08-16T18:00:00.000Z';
    await expectQueryEqual(
      pair,
      sql<{ id: string; space_id: string; deleted_at: string | null }>`
        UPDATE spaces_open_sessions
        SET deleted_at = ${now}
        WHERE space_id = ${'s1'} AND deleted_at IS NULL
        RETURNING *
      `
    );
  });

  test('quotes better-auth primary subquery alias', async () => {
    const pair = await openPair();
    await setupBoth(pair, [
      raw(
        'CREATE TABLE better_auth_user (id TEXT PRIMARY KEY, email TEXT NOT NULL)'
      ),
      sql<void>`INSERT INTO better_auth_user (id, email) VALUES (${'u1'}, ${'a@b.co'})`,
    ]);
    await expectQueryEqual(
      pair,
      sql<{
        id: string;
        email: string;
      }>`select "primary".* from (select * from "better_auth_user" where "better_auth_user"."email" = ${'a@b.co'}) as "primary"`
    );
  });

  test('ON CONFLICT DO UPDATE WHERE', async () => {
    const pair = await openPair();
    await setupBoth(pair, [
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
          ${'better-auth:ext1'}, ${'user-a'}, ${'better-auth'}, ${'ext1'},
          ${'{}'}, ${'t0'}
        )
      `,
      sql<void>`
        INSERT INTO auth_external_accounts (
          id, user_id, provider, external_id, metadata, updated_at
        )
        VALUES (
          ${'better-auth:ext1'}, ${'user-a'}, ${'better-auth'}, ${'ext1'},
          ${'{"email":"a@b.co"}'}, ${'t1'}
        )
        ON CONFLICT (provider, external_id) DO UPDATE SET
          metadata = excluded.metadata,
          updated_at = excluded.updated_at
        WHERE auth_external_accounts.user_id = excluded.user_id
      `,
    ]);
    await expectQueryEqual(
      pair,
      raw<{ metadata: string; updated_at: string }>(
        'SELECT metadata, updated_at FROM auth_external_accounts'
      )
    );
  });

  test('ON CONFLICT DO UPDATE with reserved col value', async () => {
    const pair = await openPair();
    await setupBoth(pair, [
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
    await expectQueryEqual(
      pair,
      raw<{ value: string; updated_at: string }>(
        'SELECT value, updated_at FROM client_config'
      )
    );
  });

  test('ON CONFLICT upsert increments and RETURNING', async () => {
    const pair = await openPair();
    await setupBoth(pair, [
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
    await expectQueryEqual(pair, upsert);
    await expectQueryEqual(pair, upsert);
  });

  test('multi-row ON CONFLICT upsert RETURNING (allocateTopicPushSeqs)', async () => {
    const pair = await openPair();
    await setupBoth(pair, [
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
    await expectQueryEqual(pair, multi);
    await expectQueryEqual(pair, multi);
  });

  test('ON CONFLICT DO NOTHING leaves existing row', async () => {
    const pair = await openPair();
    await setupBoth(pair, [
      raw('CREATE TABLE kv (id TEXT PRIMARY KEY, v TEXT NOT NULL)'),
      sql<void>`INSERT INTO kv (id, v) VALUES (${'k'}, ${'old'})`,
      sql<void>`
        INSERT INTO kv (id, v) VALUES (${'k'}, ${'new'})
        ON CONFLICT (id) DO NOTHING
      `,
    ]);
    await expectQueryEqual(
      pair,
      raw<{ id: string; v: string }>('SELECT id, v FROM kv')
    );
  });

  test('parameterized LIMIT / OFFSET', async () => {
    const pair = await openPair();
    await setupBoth(pair, [
      raw('CREATE TABLE t (id INTEGER PRIMARY KEY)'),
      sql<void>`INSERT INTO t (id) VALUES (${1})`,
      sql<void>`INSERT INTO t (id) VALUES (${2})`,
      sql<void>`INSERT INTO t (id) VALUES (${3})`,
      sql<void>`INSERT INTO t (id) VALUES (${4})`,
      sql<void>`INSERT INTO t (id) VALUES (${5})`,
    ]);
    await expectQueryEqual(
      pair,
      sql<{ id: number }>`
        SELECT id FROM t WHERE id > ${0} ORDER BY id LIMIT ${2} OFFSET ${1}
      `
    );
  });

  test('nested subquery IN (SELECT …)', async () => {
    const pair = await openPair();
    await setupBoth(pair, [
      raw('CREATE TABLE spaces (id TEXT, host_member_id TEXT)'),
      raw('CREATE TABLE spaces_users (id TEXT, space_id TEXT, user_id TEXT)'),
      sql<void>`INSERT INTO spaces (id, host_member_id) VALUES (${'s1'}, ${'u'})`,
      sql<void>`INSERT INTO spaces_users (id, space_id, user_id) VALUES (${'su1'}, ${'s1'}, ${'u2'})`,
    ]);
    await expectQueryEqual(
      pair,
      sql<{ id: string }>`
        SELECT id FROM spaces_users
        WHERE space_id IN (
          SELECT id FROM spaces WHERE host_member_id = ${'u'}
        )
      `
    );
  });

  test('join + ORDER BY', async () => {
    const pair = await openPair();
    await setupBoth(pair, [
      raw('CREATE TABLE a (id TEXT PRIMARY KEY, n INTEGER)'),
      raw('CREATE TABLE b (id TEXT PRIMARY KEY, a_id TEXT, label TEXT)'),
      sql<void>`INSERT INTO a (id, n) VALUES (${'a1'}, ${1})`,
      sql<void>`INSERT INTO a (id, n) VALUES (${'a2'}, ${2})`,
      sql<void>`INSERT INTO b (id, a_id, label) VALUES (${'b1'}, ${'a1'}, ${'x'})`,
      sql<void>`INSERT INTO b (id, a_id, label) VALUES (${'b2'}, ${'a2'}, ${'y'})`,
    ]);
    await expectQueryEqual(
      pair,
      sql<{ id: string; label: string; n: number }>`
        SELECT b.id, b.label, a.n
          FROM b
          JOIN a ON a.id = b.a_id
         ORDER BY a.n DESC
      `
    );
  });

  test('COUNT(*) AS count', async () => {
    const pair = await openPair();
    await setupBoth(pair, [
      raw(
        'CREATE TABLE inbox_interactions (id TEXT, user_id TEXT, active INT, read_at INT, archived_at INT, dismissed_at INT)'
      ),
      sql<void>`INSERT INTO inbox_interactions (id, user_id, active) VALUES (${'1'}, ${'u'}, ${1})`,
    ]);
    await expectQueryEqual(
      pair,
      sql<{ count: number }>`
        SELECT COUNT(*) AS count
          FROM inbox_interactions
         WHERE user_id = ${'u'}
           AND active = ${1}
           AND read_at IS NULL
      `
    );
  });

  test('schema_ prefix columns + ON CONFLICT', async () => {
    const pair = await openPair();
    await setupBoth(pair, [
      raw(
        'CREATE TABLE inbox_schema_state (id INT PRIMARY KEY, schema_fingerprint TEXT NOT NULL)'
      ),
      sql<void>`
        INSERT INTO inbox_schema_state (id, schema_fingerprint)
        VALUES (1, ${'fp-v1'})
        ON CONFLICT (id) DO UPDATE SET schema_fingerprint = EXCLUDED.schema_fingerprint
      `,
    ]);
    await expectQueryEqual(
      pair,
      raw<{ schema_fingerprint: string }>(
        'SELECT schema_fingerprint FROM inbox_schema_state WHERE id = 1'
      )
    );
  });

  test('transaction commit persists', async () => {
    const pair = await openPair();
    await setupBoth(pair, [raw('CREATE TABLE items (id INTEGER PRIMARY KEY)')]);
    await pair.alasql.transaction(async (tx) => {
      await tx.run(sql<void>`INSERT INTO items (id) VALUES (${1})`);
    });
    await pair.sqlite.transaction(async (tx) => {
      await tx.run(sql<void>`INSERT INTO items (id) VALUES (${1})`);
    });
    await expectQueryEqual(
      pair,
      raw<{ id: number }>('SELECT id FROM items ORDER BY id')
    );
  });

  test('transaction rollback restores rows', async () => {
    const pair = await openPair();
    await setupBoth(pair, [
      raw('CREATE TABLE items (id INTEGER PRIMARY KEY)'),
      sql<void>`INSERT INTO items (id) VALUES (${1})`,
    ]);
    await expect(
      pair.alasql.transaction(async (tx) => {
        await tx.run(sql<void>`INSERT INTO items (id) VALUES (${2})`);
        throw new Error('abort');
      })
    ).rejects.toThrow('abort');
    await expect(
      pair.sqlite.transaction(async (tx) => {
        await tx.run(sql<void>`INSERT INTO items (id) VALUES (${2})`);
        throw new Error('abort');
      })
    ).rejects.toThrow('abort');
    await expectQueryEqual(
      pair,
      raw<{ id: number }>('SELECT id FROM items ORDER BY id')
    );
  });

  test('prepare + repeated query/run', async () => {
    const pair = await openPair();
    await setupBoth(pair, [
      raw('CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)'),
    ]);
    const insertSql = raw<Record<string, never>>(
      'INSERT INTO t (id, name) VALUES (?, ?)'
    );
    const aIns = pair.alasql.prepare(insertSql);
    const sIns = pair.sqlite.prepare(insertSql);
    await aIns.run([1, 'a']);
    await sIns.run([1, 'a']);
    await aIns.run([2, 'b']);
    await sIns.run([2, 'b']);

    const selectSql = sql<{ id: number; name: string }>`
      SELECT id, name FROM t WHERE id = ?
    `;
    const aSel = pair.alasql.prepare(selectSql);
    const sSel = pair.sqlite.prepare(selectSql);
    expect(await aSel.query([1])).toEqual(await sSel.query([1]));
    expect(await aSel.query([2])).toEqual(await sSel.query([2]));
  });

  test('NULL / soft-delete IS NULL filter', async () => {
    const pair = await openPair();
    await setupBoth(pair, [
      raw(
        'CREATE TABLE domain_rows (id TEXT PRIMARY KEY, deleted_at TEXT, body TEXT)'
      ),
      sql<void>`INSERT INTO domain_rows (id, deleted_at, body) VALUES (${'alive'}, NULL, ${'a'})`,
      sql<void>`INSERT INTO domain_rows (id, deleted_at, body) VALUES (${'gone'}, ${'t1'}, ${'b'})`,
    ]);
    await expectQueryEqual(
      pair,
      sql<{ id: string; body: string }>`
        SELECT id, body FROM domain_rows WHERE deleted_at IS NULL ORDER BY id
      `
    );
    await expectRunEqual(
      pair,
      sql<void>`UPDATE domain_rows SET deleted_at = ${'t2'} WHERE id = ${'alive'}`
    );
    await expectQueryEqual(
      pair,
      raw<{ id: string }>('SELECT id FROM domain_rows WHERE deleted_at IS NULL')
    );
  });

  test('UNIQUE conflict in transaction leaves prior state', async () => {
    const pair = await openPair();
    await setupBoth(pair, [
      raw('CREATE TABLE t (id TEXT PRIMARY KEY, v TEXT)'),
      sql<void>`INSERT INTO t (id, v) VALUES (${'k'}, ${'v1'})`,
    ]);
    for (const client of [pair.alasql, pair.sqlite]) {
      await expect(
        client.transaction(async (tx) => {
          await tx.run(
            sql<void>`INSERT INTO t (id, v) VALUES (${'k'}, ${'v2'})`
          );
        })
      ).rejects.toThrow();
    }
    await expectQueryEqual(
      pair,
      raw<{ id: string; v: string }>('SELECT id, v FROM t')
    );
  });

  test('UPDATE changes count matches', async () => {
    const pair = await openPair();
    await setupBoth(pair, [
      raw('CREATE TABLE counters (id INTEGER, n INTEGER)'),
      raw('INSERT INTO counters VALUES (1, 0)'),
      raw('INSERT INTO counters VALUES (2, 0)'),
    ]);
    await expectRunEqual(
      pair,
      sql<void>`UPDATE counters SET n = 1 WHERE id = ${1}`
    );
    await expectQueryEqual(
      pair,
      raw<{ id: number; n: number }>('SELECT id, n FROM counters ORDER BY id')
    );
  });
});

describe('AlaSQL lifecycle', () => {
  test('named databases are isolated', async () => {
    const alice = await openAla('unit_alasql_alice');
    const bob = await openAla('unit_alasql_bob');
    await alice.run(raw('CREATE TABLE t (id INTEGER, name TEXT)'));
    await bob.run(raw('CREATE TABLE t (id INTEGER, name TEXT)'));
    await alice.run(sql<void>`INSERT INTO t VALUES (${1}, ${'alice'})`);
    await bob.run(sql<void>`INSERT INTO t VALUES (${1}, ${'bob'})`);
    expect(
      await alice.query(raw<{ id: number; name: string }>('SELECT * FROM t'))
    ).toEqual([{ id: 1, name: 'alice' }]);
    expect(
      await bob.query(raw<{ id: number; name: string }>('SELECT * FROM t'))
    ).toEqual([{ id: 1, name: 'bob' }]);
  });

  test('disconnect drops named database for clean reopen', async () => {
    const first = SqlClientImplAlaSql.open('unit_alasql_reopen');
    await first.connect();
    await first.run(raw('CREATE TABLE t (id INTEGER)'));
    await first.run(sql<void>`INSERT INTO t VALUES (${1})`);
    await first.disconnect();

    const second = await openAla('unit_alasql_reopen');
    await second.run(raw('CREATE TABLE t (id INTEGER)'));
    expect(await second.query(raw<{ id: number }>('SELECT * FROM t'))).toEqual(
      []
    );
  });
});

describe('known divergences', () => {
  // AlaSQL WITH CTEs cannot see base tables; Bun SQLite can.
  // Product SQL must use nested subqueries instead (covered in equivalence suite).
  test('WITH CTE cannot see base tables on AlaSQL; Bun succeeds', async () => {
    const pair = await openPair();
    await setupBoth(pair, [
      raw('CREATE TABLE spaces (id TEXT, host_member_id TEXT)'),
      raw('CREATE TABLE spaces_users (id TEXT, space_id TEXT, user_id TEXT)'),
    ]);
    const cte = sql<{ id: string }>`
      WITH related AS (
        SELECT id FROM spaces WHERE host_member_id = ${'u'}
      )
      SELECT id FROM spaces_users WHERE space_id IN (SELECT id FROM related)
    `;
    // AlaSQL throws synchronously from query(); Bun returns [].
    expect(() => {
      void pair.alasql.query(cte);
    }).toThrow(/Table does not exist/);
    expect(await pair.sqlite.query(cte)).toEqual([]);
  });

  // Bun SQLite rejects nested BEGIN; AlaSQL pass-throughs nested transaction().
  test('nested transaction: AlaSQL pass-through; Bun rejects', async () => {
    const pair = await openPair();
    await setupBoth(pair, [
      raw('CREATE TABLE items (id INTEGER PRIMARY KEY)'),
      sql<void>`INSERT INTO items (id) VALUES (${1})`,
    ]);
    await expect(
      pair.alasql.transaction(async (tx) => {
        await tx.run(sql<void>`INSERT INTO items (id) VALUES (${2})`);
        await tx.transaction(async (inner) => {
          await inner.run(sql<void>`INSERT INTO items (id) VALUES (${3})`);
        });
        throw new Error('abort-outer');
      })
    ).rejects.toThrow('abort-outer');
    expect(
      await pair.alasql.query(
        raw<{ id: number }>('SELECT id FROM items ORDER BY id')
      )
    ).toEqual([{ id: 1 }]);

    await expect(
      pair.sqlite.transaction(async (tx) => {
        await tx.run(sql<void>`INSERT INTO items (id) VALUES (${2})`);
        await tx.transaction(async (inner) => {
          await inner.run(sql<void>`INSERT INTO items (id) VALUES (${3})`);
        });
      })
    ).rejects.toThrow(/cannot start a transaction within a transaction/);
  });
});
