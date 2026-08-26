import { afterEach, describe, expect, test } from 'bun:test';
import { raw, sql } from '@pkgs/sql';
import { runSqlDataSnapshotContractTests } from '../sql-data-snapshot/contract';
import {
  createPostgresMemSqlClient,
  SqlClientImplPostgresMem,
} from './impl-postgres-mem';

const openClients: SqlClientImplPostgresMem[] = [];

afterEach(async () => {
  while (openClients.length > 0) {
    const client = openClients.pop();
    if (client) await client.disconnect();
  }
});

async function openMem(): Promise<SqlClientImplPostgresMem> {
  const client = SqlClientImplPostgresMem.open({ seed: 1 });
  await client.connect();
  openClients.push(client);
  return client;
}

describe('SqlClientImplPostgresMem lifecycle', () => {
  test('instances are isolated', async () => {
    const alice = await openMem();
    const bob = await openMem();
    await alice.run(raw('CREATE TABLE t (id int, name text)'));
    await bob.run(raw('CREATE TABLE t (id int, name text)'));
    await alice.run(sql<void>`INSERT INTO t VALUES (${1}, ${'alice'})`);
    await bob.run(sql<void>`INSERT INTO t VALUES (${1}, ${'bob'})`);
    expect(
      await alice.query(raw<{ id: number; name: string }>('SELECT * FROM t'))
    ).toEqual([{ id: 1, name: 'alice' }]);
    expect(
      await bob.query(raw<{ id: number; name: string }>('SELECT * FROM t'))
    ).toEqual([{ id: 1, name: 'bob' }]);
  });

  test('parameterized query + gen_random_uuid', async () => {
    const { sqlClient } = createPostgresMemSqlClient({ seed: 1 });
    openClients.push(sqlClient);
    await sqlClient.connect();
    await sqlClient.run(sql`
      CREATE TABLE items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL
      )
    `);
    await sqlClient.run(sql`INSERT INTO items (name) VALUES (${'alpha'})`);
    const rows = await sqlClient.query<{ id: string; name: string }>(sql`
      SELECT id, name FROM items WHERE name = ${'alpha'}
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('alpha');
    expect(rows[0]?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  test('transaction rolls back on error', async () => {
    const client = await openMem();
    await client.run(raw('CREATE TABLE kv (k text PRIMARY KEY, v int)'));
    await client.run(sql`INSERT INTO kv (k, v) VALUES (${'a'}, ${1})`);
    await expect(
      client.transaction(async (tx) => {
        await tx.run(sql`INSERT INTO kv (k, v) VALUES (${'b'}, ${2})`);
        throw new Error('force rollback');
      })
    ).rejects.toThrow('force rollback');
    const rows = await client.query<{ k: string }>(sql`
      SELECT k FROM kv ORDER BY k
    `);
    expect(rows.map((r) => r.k)).toEqual(['a']);
  });

  test('transaction commits on success', async () => {
    const client = await openMem();
    await client.run(raw('CREATE TABLE kv (k text PRIMARY KEY, v int)'));
    await client.transaction(async (tx) => {
      await tx.run(sql`INSERT INTO kv (k, v) VALUES (${'a'}, ${1})`);
      await tx.run(sql`INSERT INTO kv (k, v) VALUES (${'b'}, ${2})`);
    });
    const rows = await client.query<{ k: string }>(sql`
      SELECT k FROM kv ORDER BY k
    `);
    expect(rows.map((r) => r.k)).toEqual(['a', 'b']);
  });

  test('snapshot round-trips rows', async () => {
    const source = await openMem();
    await source.run(raw('CREATE TABLE t (id int)'));
    await source.run(sql<void>`INSERT INTO t VALUES (${7})`);
    const bytes = source.exportDatabaseBytes();

    const dest = await openMem();
    dest.importDatabaseBytes(bytes);
    expect(await dest.query(raw<{ id: number }>('SELECT id FROM t'))).toEqual([
      { id: 7 },
    ]);
  });

  test('json_extract shim works', async () => {
    const client = await openMem();
    const rows = await client.query<{ v: string | null }>(sql`
      SELECT json_extract(${'{"a":1}'}, ${'$.a'}) AS v
    `);
    expect(rows[0]?.v).toBe('1');
  });

  test('int8 rows coerce bigint to number for JSON safety', async () => {
    const client = await openMem();
    const rows = await client.query<{ n: number }>(sql`
      SELECT 42::int8 AS n
    `);
    expect(rows[0]?.n).toBe(42);
    expect(typeof rows[0]?.n).toBe('number');
    expect(() => JSON.stringify(rows)).not.toThrow();
  });
});

describe('SqlDataSnapshot postgres-mem', () => {
  runSqlDataSnapshotContractTests(() =>
    SqlClientImplPostgresMem.open({ seed: 1 })
  );
});
