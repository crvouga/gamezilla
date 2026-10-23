import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import { attachToGlobal } from '@pkgs/sql-cli-shared-ts/attach-to-global';
import { createSqlCli } from '@pkgs/sql-cli-shared-ts/create-sql-cli';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import { raw } from '@pkgs/sql-root-shared-ts/sql';

const usersSchema = registerTables([
  defineTable({
    domain: 'users',
    name: 'users',
    columns: { name: 'text' },
  }),
]);

describe('createSqlCli', () => {
  let client: SqlClient;

  beforeEach(async () => {
    client = SqlClientImplBunSqlite.open(':memory:');
    await client.connect();
    await reconcileSqliteSchema(client, usersSchema);
    await client.run(
      raw(`INSERT INTO users (id, name) VALUES ('u1', 'alice')`)
    );
  });

  afterEach(async () => {
    await client.disconnect();
  });

  test('help lists commands', async () => {
    const { evaluate } = createSqlCli({ client, print: false });
    const result = await evaluate('help');
    expect(result.kind).toBe('rows');
    if (result.kind !== 'rows') return;
    expect(result.rows.length).toBeGreaterThan(0);
    expect(
      result.rows.some((row) => String(row['description']).includes('tables'))
    ).toBe(true);
  });

  test('\\dt lists tables', async () => {
    const { evaluate } = createSqlCli({ client, print: false });
    const result = await evaluate('\\dt');
    expect(result.kind).toBe('rows');
    if (result.kind !== 'rows') return;
    expect(result.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table_name: 'users', type: 'table' }),
      ])
    );
  });

  test('dt without backslash lists tables', async () => {
    const { evaluate } = createSqlCli({ client, print: false });
    const result = await evaluate('dt');
    expect(result.kind).toBe('rows');
  });

  test('\\d describes a table', async () => {
    const { evaluate } = createSqlCli({ client, print: false });
    const result = await evaluate('\\d users');
    expect(result.kind).toBe('rows');
    if (result.kind !== 'rows') return;
    expect(result.rows.length).toBeGreaterThanOrEqual(2);
    expect(result.rows.map((row) => row['name'])).toEqual(
      expect.arrayContaining([
        'id',
        'name',
        'created_at',
        'updated_at',
        'deleted_at',
      ])
    );
  });

  test('summary returns row counts', async () => {
    const { evaluate } = createSqlCli({ client, print: false });
    const result = await evaluate('summary');
    expect(result.kind).toBe('rows');
    if (result.kind !== 'rows') return;
    expect(result.rows).toEqual([
      expect.objectContaining({ table_name: 'users', row_count: '1' }),
    ]);
  });

  test('SELECT returns rows via tagged template', async () => {
    const { sql } = createSqlCli({ client, print: false });
    const result = await sql`SELECT name FROM users`;
    expect(result.kind).toBe('rows');
    if (result.kind !== 'rows') return;
    expect(result.rows).toEqual([{ name: 'alice' }]);
  });

  test('INSERT returns run result', async () => {
    const { evaluate } = createSqlCli({ client, print: false });
    const result = await evaluate(
      `INSERT INTO users (id, name) VALUES ('u2', 'bob')`
    );
    expect(result.kind).toBe('run');
    if (result.kind !== 'run') return;
    expect(result.result.changes).toBe(1);
  });

  test('tagged template preserves \\dt via .raw', async () => {
    const { sql } = createSqlCli({ client, print: false });
    const result = await sql`\dt`;
    expect(result.kind).toBe('rows');
  });

  test('empty input returns message', async () => {
    const { evaluate } = createSqlCli({ client, print: false });
    const result = await evaluate('   ');
    expect(result).toEqual({
      kind: 'message',
      message: 'No command provided',
    });
  });
});

describe('attachToGlobal', () => {
  test('sets globalThis property', async () => {
    const client = SqlClientImplBunSqlite.open(':memory:');
    await client.connect();
    const { sql } = createSqlCli({ client, print: false });
    attachToGlobal(sql, { name: '__test_sql_cli__' });
    expect(Reflect.get(globalThis, '__test_sql_cli__')).toBe(sql);
    Reflect.deleteProperty(globalThis, '__test_sql_cli__');
    await client.disconnect();
  });
});
