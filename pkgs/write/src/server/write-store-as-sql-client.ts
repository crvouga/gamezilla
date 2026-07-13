import type { SqlClient } from '@pkgs/sql-client/interface';

import type { WriteStore } from '../shared/write-store';

/** Adapts {@link WriteStore} for code that still expects {@link SqlClient}. */
export function writeStoreAsSqlClient(store: WriteStore): SqlClient {
  return {
    connect: async () => {},
    disconnect: async () => {},
    query: (sql, params) => store.query(sql, params),
    run: async (sql, params) => {
      const result = await store.run(sql, params);
      return { changes: result.changes, lastInsertRowid: 0 };
    },
    transaction: (fn) =>
      store.transaction((tx) => fn(writeStoreAsSqlClient(tx))),
    prepare: (sql) => ({
      query: (params) => store.query(sql, params),
      run: async (params) => {
        const result = await store.run(sql, params);
        return { changes: result.changes, lastInsertRowid: 0 };
      },
    }),
  };
}
