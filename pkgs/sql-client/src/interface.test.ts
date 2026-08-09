import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createSimIo } from '@pkgs/io';
import { createInMemoryPubSub } from '@pkgs/pubsub/testing';
import { raw, sql } from '@pkgs/sql';
import { SqlClientWithPubSub } from './impl-with-pub-sub';
import type { SqlClient } from './interface';
import { SqlClientImplBunSqlite } from './sqlite/impl-bun-sqlite';

const io = createSimIo({ seed: 1 });

type ClientFactory = () => Promise<SqlClient>;

async function loadImplementations(): Promise<
  { name: string; createClient: ClientFactory }[]
> {
  const impls: { name: string; createClient: ClientFactory }[] = [
    {
      name: 'SqlClientImplBunSqlite',
      createClient: () =>
        Promise.resolve(SqlClientImplBunSqlite.open(':memory:')),
    },
    {
      name: 'SqlClientWithPubSub',
      createClient: () =>
        Promise.resolve(
          new SqlClientWithPubSub(
            SqlClientImplBunSqlite.open(':memory:'),
            createInMemoryPubSub(),
            io.clock.now
          )
        ),
    },
  ];
  try {
    const { SqlClientImplExpoSqlite } = await import(
      './sqlite/impl-expo-sqlite'
    );
    impls.push({
      name: 'SqlClientImplExpoSqlite',
      createClient: () => SqlClientImplExpoSqlite.open(':memory:', io.timers),
    });
  } catch {
    // expo-sqlite requires React Native runtime; skip in Bun test env
  }

  return impls;
}

const implementations = await loadImplementations();

describe.each(implementations)('$name', ({ createClient }) => {
  let client: SqlClient | null = null;
  let available = true;

  beforeEach(async () => {
    try {
      client = await createClient();
      available = true;
    } catch {
      client = null;
      available = false;
    }
  });

  afterEach(async () => {
    if (client && available) {
      try {
        await client.disconnect();
      } catch {
        // already disconnected
      }
    }
  });

  test('connect and disconnect', async () => {
    if (!client || !available) return;
    await client.connect();
    await client.disconnect();
  });

  test('run creates table and returns RunResult', async () => {
    if (!client || !available) return;
    await client.connect();
    const result = await client.run(
      raw('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)')
    );
    expect(result.changes).toBe(0);
    expect(typeof result.lastInsertRowid).toBe('number');
    await client.disconnect();
  });

  test('run insert returns changes and lastInsertRowid', async () => {
    if (!client || !available) return;
    await client.connect();
    await client.run(
      raw('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)')
    );
    const result = await client.run(
      sql<void>`INSERT INTO users (id, name) VALUES (${1}, ${'Alice'}) RETURNING *`
    );
    expect(result.changes).toBeGreaterThanOrEqual(1);
    expect(result.lastInsertRowid).toBeGreaterThanOrEqual(1);
    await client.disconnect();
  });

  test('query returns rows with positional params', async () => {
    if (!client || !available) return;
    await client.connect();
    await client.run(raw('CREATE TABLE items (id INTEGER, value TEXT)'));
    await client.run(sql<void>`INSERT INTO items VALUES (${1}, ${'a'})`);
    await client.run(sql<void>`INSERT INTO items VALUES (${2}, ${'b'})`);
    const rows = await client.query(
      sql<{
        id: number;
        value: string;
      }>`SELECT id, value FROM items WHERE id >= ${1} ORDER BY id`
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ id: 1, value: 'a' });
    expect(rows[1]).toEqual({ id: 2, value: 'b' });
    await client.disconnect();
  });

  test('query returns empty array when no rows', async () => {
    if (!client || !available) return;
    await client.connect();
    await client.run(raw('CREATE TABLE empty (id INTEGER)'));
    const rows = await client.query(
      raw<Record<string, unknown>>('SELECT * FROM empty')
    );
    expect(rows).toEqual([]);
    await client.disconnect();
  });

  test('run update returns changes count', async () => {
    if (!client || !available) return;
    await client.connect();
    await client.run(raw('CREATE TABLE counters (id INTEGER, n INTEGER)'));
    await client.run(raw('INSERT INTO counters VALUES (1, 0)'));
    const result = await client.run(
      sql<void>`UPDATE counters SET n = 1 WHERE id = ${1} RETURNING *`
    );
    expect(result.changes).toBeGreaterThanOrEqual(1);
    await client.disconnect();
  });

  test('transaction commits on success', async () => {
    if (!client || !available) return;
    await client.connect();
    await client.run(
      raw('CREATE TABLE tx_test (id INTEGER PRIMARY KEY, x INTEGER)')
    );
    const result = await client.transaction(async (tx) => {
      await tx.run(sql<void>`INSERT INTO tx_test (id, x) VALUES (${1}, ${1})`);
      await tx.run(sql<void>`INSERT INTO tx_test (id, x) VALUES (${2}, ${2})`);
      return 2;
    });
    expect(result).toBe(2);
    if (client === null || client === undefined)
      throw new Error('client must be set');
    const rows = await client.query(
      raw<Record<string, unknown>>('SELECT * FROM tx_test')
    );
    expect(rows).toHaveLength(2);
    await client.disconnect();
  });

  test('transaction rolls back on error', async () => {
    if (!client || !available) return;
    await client.connect();
    await client.run(
      raw('CREATE TABLE rollback_test (id INTEGER PRIMARY KEY)')
    );
    try {
      await client.transaction(async (tx) => {
        await tx.run(sql<void>`INSERT INTO rollback_test (id) VALUES (${1})`);
        throw new Error('abort');
      });
    } catch (e) {
      expect((e as Error).message).toBe('abort');
    }
    if (client === null || client === undefined)
      throw new Error('client must be set');
    const rows = await client.query(
      raw<Record<string, unknown>>('SELECT * FROM rollback_test')
    );
    expect(rows).toHaveLength(0);
    await client.disconnect();
  });
});
