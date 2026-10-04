import { ATTR } from '@pkgs/observability-shared/attributes';
import { activeSpan, withSpan } from '@pkgs/observability-shared/span';
import { serializeTraceContext } from '@pkgs/observability-shared/correlation';
import { Sql } from '@pkgs/sql-shared/sql';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';

const MAX_QUERY_TEXT_LENGTH = 2_000;

function sqlOperation(statement: string): string {
  return statement.trimStart().split(/\s+/, 1)[0]?.toUpperCase() ?? 'UNKNOWN';
}

function truncateStatement(statement: string): string {
  if (statement.length <= MAX_QUERY_TEXT_LENGTH) return statement;
  return `${statement.slice(0, MAX_QUERY_TEXT_LENGTH)}…`;
}

/**
 * Attach W3C correlation to sampled statements only. Unsampled statements
 * retain byte-identical text so prepared statement and plan caches remain
 * effective. Values remain bound; the comment contains no application data.
 */
function withSqlCommenter<T>(query: Sql<T>): Sql<T> {
  const span = activeSpan();
  if (span === undefined || (span.spanContext().traceFlags & 1) === 0) {
    return query;
  }
  const traceparent = serializeTraceContext();
  if (traceparent === undefined) return query;
  const strings = [...query.strings];
  const last = strings.length - 1;
  strings[last] = `${strings[last]} /*traceparent='${traceparent}'*/`;
  return new Sql<T>(strings, query.values);
}

async function runObservedSql<T>(
  query: Sql<unknown>,
  run: (observed: Sql<unknown>) => Promise<T>
): Promise<T> {
  return withSpan('db.query', () => run(withSqlCommenter(query)), {
    [ATTR.DB_SYSTEM_NAME]: 'postgresql',
    [ATTR.DB_OPERATION_NAME]: sqlOperation(query.sql),
    [ATTR.DB_QUERY_TEXT]: truncateStatement(query.sql),
    [ATTR.CODE_FILE_PATH]:
      'libs/app-shared/src/wrap-sql-client.ts',
    [ATTR.CODE_FUNCTION_NAME]: 'runObservedSql',
  });
}

export function wrapSqlClientForObservability(inner: SqlClient): SqlClient {
  return {
    connect: () => inner.connect(),
    disconnect: () => inner.disconnect(),
    query: <T extends Record<string, unknown>>(query: Sql<T>) =>
      runObservedSql(query, (observed) => inner.query(observed as Sql<T>)),
    run: (query: Sql<unknown>) =>
      runObservedSql(query, (observed) => inner.run(observed)),
    transaction: <T>(fn: (tx: SqlClient) => Promise<T>) =>
      withSpan(
        'db.transaction',
        () => inner.transaction((tx) => fn(wrapSqlClientForObservability(tx))),
        {
          [ATTR.DB_SYSTEM_NAME]: 'postgresql',
          [ATTR.CODE_FILE_PATH]:
            'libs/app-shared/src/wrap-sql-client.ts',
          [ATTR.CODE_FUNCTION_NAME]: 'transaction',
        }
      ),
    prepare: <T extends Record<string, unknown>>(query: Sql<T>) =>
      inner.prepare(query),
  };
}
