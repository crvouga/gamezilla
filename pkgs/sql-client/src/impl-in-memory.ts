import type { RunResult, SqlClient } from './interface';

/** Minimal SqlClient stub for authorize-only / parse-path unit tests. */
export function createInMemorySqlClient(): SqlClient {
  const client: SqlClient = {
    connect: async () => {},
    disconnect: async () => {},
    query: async <T>(_sql: string, _params?: unknown[]) => [] as T[],
    run: async (_sql: string, _params?: unknown[]) =>
      ({ changes: 0, lastInsertRowid: 0 }) satisfies RunResult,
    transaction: async (fn) => fn(client),
    prepare: (sql) => ({
      query: (params) => client.query(sql, params),
      run: (params) => client.run(sql, params),
    }),
  };

  return client;
}
