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
import { Sql, type Value } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

export const TEST_LOCAL_SQL_GLOBAL = '__testLocalSql';

export type TestLocalSql = {
  query(strings: readonly string[], values: readonly Value[]): Promise<string>;
  run(strings: readonly string[], values: readonly Value[]): Promise<string>;
};

const env = import.meta.env as { VITE_TEST_HOOKS?: string };

/** Registers `client` as the one the hook answers against (test builds only). */
export function exposeLocalSqlForTests(client: SqlClient): void {
  if (env.VITE_TEST_HOOKS !== '1') return;
  const hook: TestLocalSql = {
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
  };
  Reflect.set(globalThis, TEST_LOCAL_SQL_GLOBAL, hook);
}
