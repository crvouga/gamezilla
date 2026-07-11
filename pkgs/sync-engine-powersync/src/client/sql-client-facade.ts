import type {
  PreparedStatement,
  RunResult,
  SqlClient,
} from '@pkgs/sql-client/interface';

import type { PowerSyncDatabasePort } from './powersync-database-port';

export function createSqlClientFromPowerSync(
  db: PowerSyncDatabasePort
): SqlClient {
  return {
    connect: () => db.connect(),
    disconnect: () => db.disconnect(),
    query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) =>
      db.getAll<T>(sql, params),
    run: async (sql: string, params?: unknown[]): Promise<RunResult> => {
      const result = await db.execute(sql, params);
      return {
        changes: result.rowsAffected ?? 0,
        lastInsertRowid: Number(result.lastInsertRowid ?? 0),
      };
    },
    transaction: async <T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> => {
      return db.writeTransaction(async (txDb) => {
        const txClient = createSqlClientFromPowerSync(txDb);
        return fn(txClient);
      });
    },
    prepare: (sql: string): PreparedStatement => ({
      query: <T = Record<string, unknown>>(params?: unknown[]) =>
        db.getAll<T>(sql, params),
      run: async (params?: unknown[]) => {
        const result = await db.execute(sql, params);
        return {
          changes: result.rowsAffected ?? 0,
          lastInsertRowid: Number(result.lastInsertRowid ?? 0),
        };
      },
    }),
  };
}
