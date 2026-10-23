import { expect, test } from 'bun:test';
import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';
import sql, { raw } from '@pkgs/sql-root-shared-ts/sql';
import type { SqliteClientGetter } from './sqlite-contract-helpers';
import {
  applySchema,
  expectQuery,
  expectRun,
  setup,
} from './sqlite-contract-helpers';

export function registerSqliteTxnTests(getClient: SqliteClientGetter): void {
  test('transaction commit persists', async () => {
    const client = getClient();
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
    const client = getClient();
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
    const client = getClient();
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
    const client = getClient();
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
    const client = getClient();
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
    const client = getClient();
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
