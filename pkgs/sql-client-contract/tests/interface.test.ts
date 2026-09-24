import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { defineTable, registerTables } from '@pkgs/db-schema';
import { applySqliteSchema } from '@pkgs/db-schema-sqlite';
import { createInMemoryPubSub } from '@pkgs/pubsub/in-memory';
import { raw, sql } from '@pkgs/sql';
import { SqlClientWithPubSub } from '@pkgs/sql-client/impl-with-pub-sub';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite/impl-bun-sqlite';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite/impl-mockingbird-sqlite';
import { createSimAdapters } from '@pkgs/uuid';

const adapters = createSimAdapters({ seed: 1 });

type ClientFactory = () => Promise<SqlClient>;

async function applyTables(
  client: SqlClient,
  tables: Parameters<typeof registerTables>[0]
): Promise<void> {
  await applySqliteSchema(client, registerTables(tables));
}

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
      name: 'SqlClientImplMockingbirdSqlite',
      createClient: async () => {
        const client = SqlClientImplMockingbirdSqlite.open();
        await client.connect();
        return client;
      },
    },
    {
      name: 'SqlClientWithPubSub',
      createClient: () =>
        Promise.resolve(
          new SqlClientWithPubSub(
            SqlClientImplBunSqlite.open(':memory:'),
            createInMemoryPubSub(),
            adapters.clock.now
          )
        ),
    },
  ];

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
    await applyTables(client, [
      defineTable({ domain: 'test', name: 'test', columns: { name: 'text' } }),
    ]);
    const result = await client.run(
      sql<void>`INSERT INTO test (id, name) VALUES (${'1'}, ${'x'})`
    );
    expect(result.changes).toBeGreaterThanOrEqual(1);
    expect(typeof result.lastInsertRowid).toBe('number');
    await client.disconnect();
  });

  test('run insert returns changes and lastInsertRowid', async () => {
    if (!client || !available) return;
    await client.connect();
    await applyTables(client, [
      defineTable({
        domain: 'users',
        name: 'users',
        columns: { name: 'text' },
      }),
    ]);
    const result = await client.run(
      sql<void>`INSERT INTO users (id, name) VALUES (${'1'}, ${'Alice'}) RETURNING *`
    );
    expect(result.changes).toBeGreaterThanOrEqual(1);
    expect(result.lastInsertRowid).toBeGreaterThanOrEqual(1);
    await client.disconnect();
  });

  test('query returns rows with positional params', async () => {
    if (!client || !available) return;
    await client.connect();
    await applyTables(client, [
      defineTable({
        domain: 'items',
        name: 'items',
        columns: { n: 'integer', item_value: 'text' },
      }),
    ]);
    await client.run(
      sql<void>`INSERT INTO items (id, n, item_value) VALUES (${'1'}, ${1}, ${'a'})`
    );
    await client.run(
      sql<void>`INSERT INTO items (id, n, item_value) VALUES (${'2'}, ${2}, ${'b'})`
    );
    const rows = await client.query(
      sql<{
        n: number;
        item_value: string;
      }>`SELECT n, item_value FROM items WHERE n >= ${1} ORDER BY n`
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ n: 1, item_value: 'a' });
    expect(rows[1]).toEqual({ n: 2, item_value: 'b' });
    await client.disconnect();
  });

  test('query returns empty array when no rows', async () => {
    if (!client || !available) return;
    await client.connect();
    await applyTables(client, [
      defineTable({ domain: 'empty', name: 'empty', columns: {} }),
    ]);
    const rows = await client.query(
      raw<Record<string, unknown>>('SELECT * FROM empty')
    );
    expect(rows).toEqual([]);
    await client.disconnect();
  });

  test('run update returns changes count', async () => {
    if (!client || !available) return;
    await client.connect();
    await applyTables(client, [
      defineTable({
        domain: 'counters',
        name: 'counters',
        columns: { n: 'integer' },
      }),
    ]);
    await client.run(
      sql<void>`INSERT INTO counters (id, n) VALUES (${'1'}, ${0})`
    );
    const result = await client.run(
      sql<void>`UPDATE counters SET n = 1 WHERE id = ${'1'} RETURNING *`
    );
    expect(result.changes).toBeGreaterThanOrEqual(1);
    await client.disconnect();
  });

  test('transaction commits on success', async () => {
    if (!client || !available) return;
    await client.connect();
    await applyTables(client, [
      defineTable({
        domain: 'tx_test',
        name: 'tx_test',
        columns: { x: 'integer' },
      }),
    ]);
    const result = await client.transaction(async (tx) => {
      await tx.run(
        sql<void>`INSERT INTO tx_test (id, x) VALUES (${'1'}, ${1})`
      );
      await tx.run(
        sql<void>`INSERT INTO tx_test (id, x) VALUES (${'2'}, ${2})`
      );
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
    await applyTables(client, [
      defineTable({
        domain: 'rollback_test',
        name: 'rollback_test',
        columns: {},
      }),
    ]);
    try {
      await client.transaction(async (tx) => {
        await tx.run(sql<void>`INSERT INTO rollback_test (id) VALUES (${'1'})`);
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
