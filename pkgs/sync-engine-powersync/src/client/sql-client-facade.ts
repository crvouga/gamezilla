import type { Sql, Value } from '@pkgs/sql';
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
    query: <T = Record<string, unknown>>(query: Sql) =>
      db.getAll<T>(query.sql, [...query.values]),
    run: async (query: Sql): Promise<RunResult> => {
      const result = await db.execute(query.sql, [...query.values]);
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
    prepare: (query: Sql): PreparedStatement => {
      const text = query.sql;
      return {
        query: <T = Record<string, unknown>>(params?: Value[]) =>
          db.getAll<T>(text, params === undefined ? undefined : [...params]),
        run: async (params?: Value[]) => {
          const result = await db.execute(
            text,
            params === undefined ? undefined : [...params]
          );
          return {
            changes: result.rowsAffected ?? 0,
            lastInsertRowid: Number(result.lastInsertRowid ?? 0),
          };
        },
      };
    },
  };
}
