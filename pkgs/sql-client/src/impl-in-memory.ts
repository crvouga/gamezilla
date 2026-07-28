import type { Sql, Value } from '@pkgs/sql';
import type { RunResult, SqlClient } from './interface';

/** Minimal SqlClient stub for authorize-only / parse-path unit tests. */
export function createInMemorySqlClient(): SqlClient {
  const client: SqlClient = {
    connect: async () => {},
    disconnect: async () => {},
    query: async <T>(_query: Sql) => [] as T[],
    run: async (_query: Sql) =>
      ({ changes: 0, lastInsertRowid: 0 }) satisfies RunResult,
    transaction: async (fn) => fn(client),
    prepare: (query) => ({
      query: async <T>(_params?: Value[]) => {
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
