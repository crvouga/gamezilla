import { afterEach, describe, expect, test } from 'bun:test';
import { defineTable, registerTables, type TableDef } from '@pkgs/db-schema';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite';
import { raw, sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite/impl-mockingbird-sqlite';

const openClients: SqlClientImplMockingbirdSqlite[] = [];

afterEach(async () => {
  while (openClients.length > 0) {
    const client = openClients.pop();
    if (client) await client.disconnect();
  }
});

async function openMem(): Promise<SqlClientImplMockingbirdSqlite> {
  const client = SqlClientImplMockingbirdSqlite.open();
  await client.connect();
  openClients.push(client);
  return client;
}

async function applyTables(
  client: SqlClient,
  tables: readonly TableDef[]
): Promise<void> {
  await reconcileSqliteSchema(client, registerTables(tables));
}

describe('SqlClientImplMockingbirdSqlite lifecycle', () => {
  test('instances are isolated', async () => {
    const alice = await openMem();
    const bob = await openMem();
    await applyTables(alice, [
      defineTable({ domain: 't', name: 't', columns: { name: 'text' } }),
    ]);
    await applyTables(bob, [
      defineTable({ domain: 't', name: 't', columns: { name: 'text' } }),
    ]);
    await alice.run(
      sql<void>`INSERT INTO t (id, name) VALUES (${'1'}, ${'alice'})`
    );
    await bob.run(
      sql<void>`INSERT INTO t (id, name) VALUES (${'1'}, ${'bob'})`
    );
    expect(
      await alice.query(
        raw<{ id: string; name: string }>('SELECT id, name FROM t')
      )
    ).toEqual([{ id: '1', name: 'alice' }]);
    expect(
      await bob.query(
        raw<{ id: string; name: string }>('SELECT id, name FROM t')
      )
    ).toEqual([{ id: '1', name: 'bob' }]);
  });

  test('disconnect then a new instance is empty', async () => {
    const first = SqlClientImplMockingbirdSqlite.open();
    await first.connect();
    await applyTables(first, [
      defineTable({ domain: 't', name: 't', columns: {} }),
    ]);
    await first.run(sql<void>`INSERT INTO t (id) VALUES (${'1'})`);
    await first.disconnect();

    const second = await openMem();
    await applyTables(second, [
      defineTable({ domain: 't', name: 't', columns: {} }),
    ]);
    expect(await second.query(raw<{ id: string }>('SELECT id FROM t'))).toEqual(
      []
    );
  });

  test('overlapping transactions serialize without nested BEGIN', async () => {
    const client = await openMem();
    await applyTables(client, [
      defineTable({ domain: 't', name: 't', columns: { n: 'integer' } }),
    ]);
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = client.transaction(async (tx) => {
      await tx.run(sql<void>`INSERT INTO t (id, n) VALUES (${'1'}, ${1})`);
      await held;
    });
    const second = client.transaction(async (tx) => {
      await tx.run(sql<void>`INSERT INTO t (id, n) VALUES (${'2'}, ${2})`);
    });
    release();
    await Promise.all([first, second]);
    const rows = await client.query(
      raw<{ id: string }>('SELECT id FROM t ORDER BY id')
    );
    expect(rows.map((row) => row.id)).toEqual(['1', '2']);
  });

  test('snapshot round-trips rows and user_version', async () => {
    const source = await openMem();
    await applyTables(source, [
      defineTable({ domain: 't', name: 't', columns: {} }),
    ]);
    await source.run(sql<void>`INSERT INTO t (id) VALUES (${'7'})`);
    await source.run(raw('PRAGMA user_version = 42'));
    const bytes = source.exportDatabaseBytes();

    const dest = await openMem();
    dest.importDatabaseBytes(bytes);
    expect(await dest.query(raw<{ id: string }>('SELECT id FROM t'))).toEqual([
      { id: '7' },
    ]);
    expect(
      await dest.query(raw<{ user_version: number }>('PRAGMA user_version'))
    ).toEqual([{ user_version: 42 }]);
  });
});
