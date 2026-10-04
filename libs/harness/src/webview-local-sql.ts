/**
 * An actor's local database when the actor is a live browser: queries run in
 * the page, against the app's own client, through the test hook the web app
 * exposes (`@libs/client-app/shell/test-local-sql`).
 */

import type { TestLocalSql } from '@libs/app-shared/test-local-sql';
import { TEST_LOCAL_SQL_GLOBAL } from '@libs/app-shared/test-local-sql';
import type { RunResult, SqlTx } from '@pkgs/sql-client-shared/interface';
import type { Sql } from '@pkgs/sql-shared/sql';

type Evaluate = { evaluate(script: string): Promise<unknown> };

async function call(
  view: Evaluate,
  method: keyof TestLocalSql,
  query: Sql<unknown>
): Promise<unknown> {
  const hook = `globalThis[${JSON.stringify(TEST_LOCAL_SQL_GLOBAL)}]`;
  const raw = await view.evaluate(
    `(${hook} ? ${hook}.${method}(${JSON.stringify(query.strings)}, ${JSON.stringify(query.values)}) : null)`
  );
  if (typeof raw !== 'string') {
    throw new Error(
      'webview local SQL: the page exposes no local database (is the web app built with VITE_TEST_HOOKS=1, and has it opened one yet?)'
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
