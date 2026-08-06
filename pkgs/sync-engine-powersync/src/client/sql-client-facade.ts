import type { Sql, Value } from '@pkgs/sql';
import type {
  PreparedStatement,
  RunResult,
  SqlClient,
} from '@pkgs/sql-client/interface';

import type { PowerSyncDatabasePort } from './powersync-database-port';

/** Strip Postgres-only lock clauses so portable mutation SQL runs on SQLite. */
function sqliteCompatSql(sqlText: string): string {
  return sqlText.replace(/\s+FOR UPDATE\b/gi, '');
}

export function createSqlClientFromPowerSync(
  db: PowerSyncDatabasePort
): SqlClient {
  return {
    connect: () => db.connect(),
    disconnect: () => db.disconnect(),
    query: <T extends Record<string, unknown>>(query: Sql<T>) =>
      db.getAll<T>(sqliteCompatSql(query.sql), [...query.values]),
    run: async (query: Sql<unknown>): Promise<RunResult> => {
      const result = await db.execute(sqliteCompatSql(query.sql), [
        ...query.values,
      ]);
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
    prepare: <T extends Record<string, unknown>>(
      query: Sql<T>
    ): PreparedStatement<T> => {
      const text = sqliteCompatSql(query.sql);
      return {
        query: (params?: Value[]) =>
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
