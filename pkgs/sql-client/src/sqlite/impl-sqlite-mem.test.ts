import { afterEach, describe, expect, test } from 'bun:test';
import { defineTable, registerTables, type TableDef } from '@pkgs/db-schema';
import { applySqliteSchema } from '@pkgs/db-schema/sqlite';
import { raw, sql } from '@pkgs/sql';
import type { SqlClient } from '../interface';
import { SqlClientImplSqliteMem } from './impl-sqlite-mem';

const openClients: SqlClientImplSqliteMem[] = [];

afterEach(async () => {
  while (openClients.length > 0) {
    const client = openClients.pop();
    if (client) await client.disconnect();
  }
});

async function openMem(): Promise<SqlClientImplSqliteMem> {
  const client = SqlClientImplSqliteMem.open();
  await client.connect();
  openClients.push(client);
  return client;
}

async function applyTables(
  client: SqlClient,
  tables: readonly TableDef[]
): Promise<void> {
  await applySqliteSchema(client, registerTables(tables));
}

describe('SqlClientImplSqliteMem lifecycle', () => {
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
    await bob.run(sql<void>`INSERT INTO t (id, name) VALUES (${'1'}, ${'bob'})`);
    expect(
      await alice.query(
        raw<{ id: string; name: string }>('SELECT id, name FROM t')
      )
    ).toEqual([{ id: '1', name: 'alice' }]);
    expect(
      await bob.query(raw<{ id: string; name: string }>('SELECT id, name FROM t'))
    ).toEqual([{ id: '1', name: 'bob' }]);
  });

  test('disconnect then a new instance is empty', async () => {
    const first = SqlClientImplSqliteMem.open();
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
    expect(
      await second.query(raw<{ id: string }>('SELECT id FROM t'))
    ).toEqual([]);
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
    expect(
      await dest.query(raw<{ id: string }>('SELECT id FROM t'))
    ).toEqual([{ id: '7' }]);
    expect(
      await dest.query(raw<{ user_version: number }>('PRAGMA user_version'))
    ).toEqual([{ user_version: 42 }]);
  });
});
