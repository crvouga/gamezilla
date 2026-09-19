/**
 * Browser E2E builds (`VITE_E2E=1`, e.g. a localhost stack under test) expose
 * the page's local database to the test harness, the way they keep
 * `data-testid`s: a scenario can then read an actor's synced rows no matter
 * which host runs the actor. Never present for end users.
 *
 * `window.__e2eLocalSql` answers against the database of the sync engine that
 * connected most recently — the current identity's (the signed-in user's once
 * they sign in). Queries arrive as the
 * `Sql` template parts, so the harness never ships SQL text the app would not
 * build itself.
 */
import { Sql, type Value } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

export const E2E_LOCAL_SQL_GLOBAL = '__e2eLocalSql';

export type E2eLocalSql = {
  query(strings: readonly string[], values: readonly Value[]): Promise<string>;
  run(strings: readonly string[], values: readonly Value[]): Promise<string>;
};

const env = import.meta.env as { VITE_E2E?: string };

/** Registers `client` as the one the hook answers against (E2E builds only). */
export function exposeLocalSqlForE2e(client: SqlClient): void {
  if (env.VITE_E2E !== '1') return;
  const hook: E2eLocalSql = {
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
  Reflect.set(globalThis, E2E_LOCAL_SQL_GLOBAL, hook);
}
