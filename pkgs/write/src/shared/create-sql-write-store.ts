import type { SqlClient } from '@pkgs/sql-client/interface';

import type { WriteStore } from './write-store';

export function createSqlWriteStore(sql: SqlClient): WriteStore {
  return {
    query: (querySql, params) => sql.query(querySql, params ? [...params] : undefined),
    run: async (runSql, params) => {
      const result = await sql.run(runSql, params ? [...params] : undefined);
      return { changes: result.changes };
    },
    transaction: (fn) => sql.transaction(fn),
  };
}
