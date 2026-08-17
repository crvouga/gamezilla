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
  const alasql = SqlClientImplAlaSql.open(`unit_alasql_div_${pairSeq}`);
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
  // Product SQL must use nested subqueries instead (covered in sqlite-contract).
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
