/**
 * SqlClient + Pool facades over a PGlite worker transport.
 */

import type { Sql, Value } from '@pkgs/sql';
import type { PreparedStatement, RunResult, SqlClient } from '../interface';
import { questionMarkParamsToDollarParams } from '../positional-params';
import type { Pool, PoolClient, QueryResult } from './pg-types';
import type { PgliteWorkerTransport } from './pglite-worker-transport';

type QueryPayload = { rows: unknown[]; affectedRows: number };

async function runWorkerQuery(
  call: PgliteWorkerTransport['call'],
  sqlText: string,
  params?: readonly unknown[]
): Promise<QueryPayload> {
  const [text, vals] = questionMarkParamsToDollarParams(sqlText, params);
  return (await call('query', {
    sql: text,
    params: vals,
  })) as QueryPayload;
}

export function createPgliteWorkerSqlClient(
  call: PgliteWorkerTransport['call']
): SqlClient {
  const sqlClient: SqlClient = {
    connect: async () => undefined,
    disconnect: async () => undefined,
    async query<T extends Record<string, unknown>>(
      query: Sql<T>
    ): Promise<T[]> {
      const result = await runWorkerQuery(call, query.sql, query.values);
      return result.rows as T[];
    },
    async run(query: Sql<unknown>): Promise<RunResult> {
      const result = await runWorkerQuery(call, query.sql, query.values);
      return { changes: result.affectedRows, lastInsertRowid: 0 };
    },
    prepare<T extends Record<string, unknown>>(
      query: Sql<T>
    ): PreparedStatement<T> {
      const statementSql = query.sql;
      return {
        query: async (params?: Value[]) => {
          const result = await runWorkerQuery(call, statementSql, params ?? []);
          return result.rows as T[];
        },
        run: async (params?: Value[]) => {
          const result = await runWorkerQuery(call, statementSql, params ?? []);
          return { changes: result.affectedRows, lastInsertRowid: 0 };
        },
      };
    },
    async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
      await call('begin');
      try {
        const result = await fn(sqlClient);
        await call('commit');
        return result;
      } catch (e) {
        await call('rollback');
        throw e;
      }
    },
  };
  return sqlClient;
}

export function createPgliteWorkerPool(
  call: PgliteWorkerTransport['call'],
  disconnect: () => Promise<void>
): Pool {
  const poolQuery = async (
    text: string,
    values?: unknown[]
  ): Promise<QueryResult> => {
    const result = (await call('query', {
      sql: text,
      params: values ?? [],
    })) as { rows: QueryResult['rows']; affectedRows: number };
    return { rows: result.rows, rowCount: result.affectedRows };
  };

  const checkoutClient = (): PoolClient => ({
    query: ((text: string, values?: unknown[]) =>
      poolQuery(text, values)) as PoolClient['query'],
    release: () => undefined,
  });

  const poolAdapter = {
    connect: (
      callback?: (
        err: Error | undefined,
        client: PoolClient | undefined,
        done: (release?: boolean | (() => void)) => void
      ) => void
    ) => {
      if (typeof callback === 'function') {
        callback(undefined, checkoutClient(), () => undefined);
        return undefined;
      }
      return Promise.resolve(checkoutClient());
    },
    query: (
      text: string,
      values?: unknown[],
      callback?: (err: Error | undefined, result: unknown) => void
    ) => {
      const run = poolQuery(text, values);
      if (typeof callback === 'function') {
        void run
          .then((result) => callback(undefined, result))
          .catch((err: unknown) => {
            callback(
              err instanceof Error ? err : new Error(String(err)),
              undefined
            );
          });
        return undefined;
      }
      return run;
    },
    end: async () => {
      await disconnect();
    },
    on: () => poolAdapter,
    totalCount: 1,
    idleCount: 1,
    waitingCount: 0,
  };

  return poolAdapter as unknown as Pool;
}
