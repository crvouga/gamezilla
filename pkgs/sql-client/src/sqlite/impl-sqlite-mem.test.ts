import { afterEach, describe, expect, test } from 'bun:test';
import { raw, sql } from '@pkgs/sql';
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

describe('SqlClientImplSqliteMem lifecycle', () => {
  test('instances are isolated', async () => {
    const alice = await openMem();
    const bob = await openMem();
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

  test('disconnect then a new instance is empty', async () => {
    const first = SqlClientImplSqliteMem.open();
    await first.connect();
    await first.run(raw('CREATE TABLE t (id INTEGER)'));
    await first.run(sql<void>`INSERT INTO t VALUES (${1})`);
    await first.disconnect();

    const second = await openMem();
    await second.run(raw('CREATE TABLE t (id INTEGER)'));
    expect(await second.query(raw<{ id: number }>('SELECT * FROM t'))).toEqual(
      []
    );
  });

  test('snapshot round-trips rows and user_version', async () => {
    const source = await openMem();
    await source.run(raw('CREATE TABLE t (id INTEGER)'));
    await source.run(sql<void>`INSERT INTO t VALUES (${7})`);
    await source.run(raw('PRAGMA user_version = 42'));
    const bytes = source.exportDatabaseBytes();

    const dest = await openMem();
    dest.importDatabaseBytes(bytes);
    expect(await dest.query(raw<{ id: number }>('SELECT id FROM t'))).toEqual([
      { id: 7 },
    ]);
    expect(
      await dest.query(raw<{ user_version: number }>('PRAGMA user_version'))
    ).toEqual([{ user_version: 42 }]);
  });
});
