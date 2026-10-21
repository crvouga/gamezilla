import { expect } from 'bun:test';
import type { TableDef } from '@pkgs/db-schema-root-shared-ts/define-table';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type { Sql } from '@pkgs/sql-root-shared-ts/sql';

export async function applySchema(
  client: SqlClient,
  tables: readonly TableDef[]
): Promise<void> {
  await reconcileSqliteSchema(client, registerTables(tables));
}

export async function setup(
  client: SqlClient,
  steps: readonly Sql<unknown>[]
): Promise<void> {
  for (const step of steps) {
    await client.run(step);
  }
}

export async function expectQuery<T extends Record<string, unknown>>(
  client: SqlClient,
  query: Sql<T>,
  expected: T[]
): Promise<void> {
  expect(await client.query(query)).toEqual(expected);
}

export async function expectRun(
  client: SqlClient,
  query: Sql<unknown>,
  expectedChanges: number
): Promise<void> {
  const result = await client.run(query);
  expect(result.changes).toBe(expectedChanges);
}

export type SqliteClientGetter = () => SqlClient;
