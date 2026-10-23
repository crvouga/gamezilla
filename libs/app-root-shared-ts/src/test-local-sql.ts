/**
 * Browser test builds (`VITE_TEST_HOOKS=1`, e.g. a localhost stack under test) expose
 * the page's local database to the test harness, the way they keep
 * `data-testid`s: a scenario can then read an actor's synced rows no matter
 * which host runs the actor. Never present for end users.
 *
 * `window.__testLocalSql` answers against the database of the sync engine that
 * connected most recently — the current identity's (the signed-in user's once
 * they sign in). Queries arrive as the
 * `Sql` template parts, so the harness never ships SQL text the app would not
 * build itself.
 */

import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { dumpData, loadData } from '@pkgs/sql-client-root-shared-ts/port';
import {
  executeSqlStatements,
  type SqlStatement,
} from '@pkgs/sql-client-root-shared-ts/statements';
import type { SqlDataDump } from '@pkgs/sql-client-root-shared-ts/types';
import type { Value } from '@pkgs/sql-root-shared-ts/sql';
import { Sql } from '@pkgs/sql-root-shared-ts/sql';

export const TEST_LOCAL_SQL_GLOBAL = '__testLocalSql';

export type TestLocalSql = {
  query(strings: readonly string[], values: readonly Value[]): Promise<string>;
  run(strings: readonly string[], values: readonly Value[]): Promise<string>;
  dump(): Promise<string>;
  restore(dump: SqlDataDump): Promise<void>;
  executeStatements(statements: readonly SqlStatement[]): Promise<string>;
};

const env = import.meta.env as { VITE_TEST_HOOKS?: string };

/** Registers `client` as the one the hook answers against (test builds only). */
export function exposeLocalSqlForTests(client: SqlClient): void {
  if (env.VITE_TEST_HOOKS !== '1') return;
  Reflect.set(globalThis, TEST_LOCAL_SQL_GLOBAL, createTestLocalSql(client));
}

export function createTestLocalSql(client: SqlClient): TestLocalSql {
  return {
    executeStatements: async (statements) => {
      const results = await executeSqlStatements(client, statements);
      return JSON.stringify(results);
    },
    query: async (strings, values) => {
      const rows = await client.query(
        new Sql<Record<string, unknown>>(strings, values)
      );
      return JSON.stringify(rows);
    },
    run: async (strings, values) => {
      const result = await client.run(new Sql(strings, values));
      return JSON.stringify(result);
    },
    dump: async () => {
      const data = await client.transaction((tx) => dumpData(tx));
      return JSON.stringify(data);
    },
    restore: (dump) => client.transaction((tx) => loadData(tx, dump)),
  };
}
