import type { Sql, Value } from '@pkgs/sql-root-shared/sql';
import type { RunResult, SqlClient } from './interface';

/** Minimal SqlClient stub for authorize-only / parse-path unit tests. */
export function createInMemorySqlClient(): SqlClient {
  const client: SqlClient = {
    connect: async () => {},
    disconnect: async () => {},
    query: async <T extends Record<string, unknown>>(_query: Sql<T>) =>
      [] as T[],
    run: async (_query: Sql<unknown>) =>
      ({ changes: 0, lastInsertRowid: 0 }) satisfies RunResult,
    transaction: async (fn) => fn(client),
    prepare: <T extends Record<string, unknown>>(query: Sql<T>) => ({
      query: async (_params?: Value[]) => {
        void query;
        return [] as T[];
      },
      run: async (_params?: Value[]) => {
        void query;
        return { changes: 0, lastInsertRowid: 0 } satisfies RunResult;
      },
    }),
  };

  return client;
}
