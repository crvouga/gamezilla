import { isObservabilityActive } from '@pkgs/observability/port/create-observability';
import type { Observability } from '@pkgs/observability/port/observability';
import {
  DB_SYSTEM_POSTGRESQL,
  Semconv,
  sqlOperation,
  truncateStatement,
} from '@pkgs/observability/shared/semconv';
import type { SqlClient } from '@pkgs/sql-client/interface';

async function runObservedSql<T>(
  observability: Observability,
  sql: string,
  run: () => Promise<T>,
  rowCount: (result: T) => number
): Promise<T> {
  const span = observability.startSpan({
    name: 'db.query',
    kind: 'internal',
    attributes: {
      [Semconv.dbSystem]: DB_SYSTEM_POSTGRESQL,
      [Semconv.dbOperation]: sqlOperation(sql),
      [Semconv.dbStatement]: truncateStatement(sql),
    },
  });
  return observability.withSpanContextAsync(span.spanContext, async () => {
    try {
      const result = await run();
      span.setAttribute(Semconv.dbRowCount, rowCount(result));
      span.setStatus({ code: 'ok' });
      return result;
    } catch (err: unknown) {
      observability.recordException(err);
      span.setStatus({
        code: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      span.end();
    }
  });
}

export function wrapSqlClientForObservability(
  observability: Observability,
  inner: SqlClient
): SqlClient {
  if (!isObservabilityActive(observability)) return inner;

  return {
    connect: () => inner.connect(),
    disconnect: () => inner.disconnect(),
    query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) =>
      runObservedSql(
        observability,
        sql,
        () => inner.query<T>(sql, params),
        (r) => r.length
      ),
    run: (sql: string, params?: unknown[]) =>
      runObservedSql(
        observability,
        sql,
        () => inner.run(sql, params),
        (r) => r.changes
      ),
    transaction: <T>(fn: (tx: SqlClient) => Promise<T>) => {
      const span = observability.startSpan({
        name: 'db.transaction',
        kind: 'internal',
        attributes: { [Semconv.dbSystem]: DB_SYSTEM_POSTGRESQL },
      });
      return observability.withSpanContextAsync(span.spanContext, async () => {
        try {
          const result = await inner.transaction((tx) =>
            fn(wrapSqlClientForObservability(observability, tx))
          );
          span.setStatus({ code: 'ok' });
          return result;
        } catch (err: unknown) {
          observability.recordException(err);
          span.setStatus({
            code: 'error',
            message: err instanceof Error ? err.message : String(err),
          });
          throw err;
        } finally {
          span.end();
        }
      });
    },
    prepare: (sql: string) => inner.prepare(sql),
  };
}
