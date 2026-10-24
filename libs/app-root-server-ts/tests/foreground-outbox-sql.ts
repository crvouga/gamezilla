import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';

/** Observe the actual HTTP replay and drain without changing transactions. */
export function observeForegroundSql(inner: SqlClient) {
  const statements: string[] = [];
  const wrap = (db: SqlClient): SqlClient => ({
    connect: () => db.connect(),
    disconnect: () => db.disconnect(),
    prepare: (query) => db.prepare(query),
    query: (query) => {
      statements.push(query.sql);
      return db.query(query);
    },
    run: (query) => {
      statements.push(query.sql);
      return db.run(query);
    },
    transaction: (body) => db.transaction((tx) => body(wrap(tx))),
  });
  return { db: wrap(inner), statements };
}
