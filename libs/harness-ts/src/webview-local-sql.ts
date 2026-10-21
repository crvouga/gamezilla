/**
 * An actor's local database when the actor is a live browser: queries run in
 * the page, against the app's own client, through the test hook the web app
 * exposes (`@libs/client-app/shell/test-local-sql`).
 */

import type { TestLocalSql } from '@libs/app-root-shared-ts/test-local-sql';
import { TEST_LOCAL_SQL_GLOBAL } from '@libs/app-root-shared-ts/test-local-sql';
import { wallClock, wallTimers } from '@pkgs/clock-shared-ts/wall';
import type {
  RunResult,
  SqlTx,
} from '@pkgs/sql-client-root-shared-ts/interface';
import type {
  ExecuteSqlStatements,
  SqlStatementOutput,
} from '@pkgs/sql-client-root-shared-ts/statements';
import type { Sql } from '@pkgs/sql-root-shared-ts/sql';
import { waitUntil } from '@pkgs/ui-testing-root-shared-ts/wait';

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

/** Execute the whole batch on the page's current database transaction. */
export function webviewSqlStatements(view: Evaluate): ExecuteSqlStatements {
  return async (statements) => {
    const hook = `globalThis[${JSON.stringify(TEST_LOCAL_SQL_GLOBAL)}]`;
    await waitUntil(() => view.evaluate(`Boolean(${hook})`), {
      now: wallClock.now,
      timers: wallTimers,
      timeoutMs: 20_000,
      description: 'the device database',
    });
    const result = await view.evaluate(
      `${hook}.executeStatements(${JSON.stringify(statements)})`
    );
    if (typeof result !== 'string')
      throw new Error('Device SQL batch unavailable');
    return JSON.parse(result) as readonly SqlStatementOutput[];
  };
}
