/**
 * An actor's local database when the actor is a live browser: queries run in
 * the page, against the app's own client, through the E2E hook the web app
 * exposes (`@apps/client/shell/e2e-local-sql`).
 */
import {
  E2E_LOCAL_SQL_GLOBAL,
  type E2eLocalSql,
} from '@apps/client/shell/e2e-local-sql';
import type { Sql } from '@pkgs/sql';
import type { RunResult, SqlTx } from '@pkgs/sql-client/interface';

type Evaluate = { evaluate(script: string): Promise<unknown> };

async function call(
  view: Evaluate,
  method: keyof E2eLocalSql,
  query: Sql<unknown>
): Promise<unknown> {
  const hook = `globalThis[${JSON.stringify(E2E_LOCAL_SQL_GLOBAL)}]`;
  const raw = await view.evaluate(
    `(${hook} ? ${hook}.${method}(${JSON.stringify(query.strings)}, ${JSON.stringify(query.values)}) : null)`
  );
  if (typeof raw !== 'string') {
    throw new Error(
      'webview local SQL: the page exposes no local database (is the web app built with VITE_E2E=1, and has it opened one yet?)'
    );
  }
  const parsed: unknown = JSON.parse(raw);
  return parsed;
}

export function webviewLocalSql(view: Evaluate): SqlTx {
  return {
    query: async <T extends Record<string, unknown>>(query: Sql<T>) =>
      (await call(view, 'query', query)) as T[],
    run: async (query) => (await call(view, 'run', query)) as RunResult,
  };
}
