import { afterEach, describe, expect, test } from 'bun:test';
import { defineTable } from '@pkgs/db-schema-shared/define-table';
import { registerTables } from '@pkgs/db-schema-shared/register-tables';
import type { TableDef } from '@pkgs/db-schema-shared/define-table';
import { reconcilePostgresSchema } from '@pkgs/db-schema-postgres-shared/reconcile-postgres-schema';
import sql, { raw } from '@pkgs/sql-shared/sql';
import type { PostgresSqlClient } from '@pkgs/sql-client-shared/interface';
import {
  createMockingbirdPostgresSqlClient,
  SqlClientImplMockingbirdPostgres,
} from '@pkgs/sql-client-postgres-server/impl-mockingbird-postgres';
import { runSqlDataSnapshotContractTests } from './sql-data-snapshot-contract';

const openClients: SqlClientImplMockingbirdPostgres[] = [];

afterEach(async () => {
  while (openClients.length > 0) {
    const client = openClients.pop();
    if (client) await client.disconnect();
  }
});

async function openMem(): Promise<SqlClientImplMockingbirdPostgres> {
  const client = SqlClientImplMockingbirdPostgres.open({ seed: 1 });
  await client.connect();
  openClients.push(client);
  return client;
}

async function applyTables(
  client: PostgresSqlClient,
  tables: readonly TableDef[]
): Promise<void> {
  await reconcilePostgresSchema(
    client,
    registerTables(tables),
    client.dbScope,
    {
      skipAdvisoryLock: true,
    }
  );
}

describe('SqlClientImplMockingbirdPostgres lifecycle', () => {
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

  test('parameterized query + explicit uuid id', async () => {
    const { sqlClient } = createMockingbirdPostgresSqlClient({ seed: 1 });
    openClients.push(sqlClient);
    await sqlClient.connect();
    await applyTables(sqlClient, [
      defineTable({
        domain: 'items',
        name: 'items',
        columns: { name: 'text' },
      }),
    ]);
    const itemId = '00000000-0000-4000-8000-000000000001';
    await sqlClient.run(
      sql`INSERT INTO items (id, name) VALUES (${itemId}, ${'alpha'})`
    );
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
    await applyTables(client, [
      defineTable({
        domain: 'kv',
        name: 'kv',
        columns: { k: 'text', v: 'integer' },
        uniqueIndexes: ['k'],
      }),
    ]);
    await client.run(
      sql`INSERT INTO kv (id, k, v) VALUES (${'a-id'}, ${'a'}, ${1})`
    );
    await expect(
      client.transaction(async (tx) => {
        await tx.run(
          sql`INSERT INTO kv (id, k, v) VALUES (${'b-id'}, ${'b'}, ${2})`
        );
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
    await applyTables(client, [
      defineTable({
        domain: 'kv',
        name: 'kv',
        columns: { k: 'text', v: 'integer' },
        uniqueIndexes: ['k'],
      }),
    ]);
    await client.transaction(async (tx) => {
      await tx.run(
        sql`INSERT INTO kv (id, k, v) VALUES (${'a-id'}, ${'a'}, ${1})`
      );
      await tx.run(
        sql`INSERT INTO kv (id, k, v) VALUES (${'b-id'}, ${'b'}, ${2})`
      );
    });
    const rows = await client.query<{ k: string }>(sql`
      SELECT k FROM kv ORDER BY k
    `);
    expect(rows.map((r) => r.k)).toEqual(['a', 'b']);
  });

  test('snapshot round-trips rows', async () => {
    const source = await openMem();
    await applyTables(source, [
      defineTable({ domain: 't', name: 't', columns: {} }),
    ]);
    await source.run(sql<void>`INSERT INTO t (id) VALUES (${'7'})`);
    const bytes = source.exportDatabaseBytes();

    const dest = await openMem();
    dest.importDatabaseBytes(bytes);
    expect(await dest.query(raw<{ id: string }>('SELECT id FROM t'))).toEqual([
      { id: '7' },
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

describe('SqlDataSnapshot mockingbird-postgres', () => {
  runSqlDataSnapshotContractTests(() =>
    SqlClientImplMockingbirdPostgres.open({ seed: 1 })
  );
});
