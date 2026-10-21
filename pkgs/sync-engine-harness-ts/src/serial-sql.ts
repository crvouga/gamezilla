import type {
  PreparedStatement,
  SqlClient,
} from '@pkgs/sql-client-root-shared-ts/interface';
import type { Sql } from '@pkgs/sql-root-shared-ts/sql';

/**
 * Serializes all transactions/runs on a Bun SQLite client.
 * Prevents nested BEGIN when merge + mutate overlap in the harness.
 */
export function createSerialSqlClient(inner: SqlClient): SqlClient {
  let chain: Promise<unknown> = Promise.resolve();

  const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = chain.then(fn, fn);
    chain = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  };

  return {
    connect: () => inner.connect(),
    disconnect: () => inner.disconnect(),
    query: (q) => inner.query(q),
    run: (q) => enqueue(() => inner.run(q)),
    prepare: <T extends Record<string, unknown>>(query: Sql<T>) => {
      const prepared = inner.prepare(query);
      const serial: PreparedStatement<T> = {
        query: (params) => prepared.query(params),
        run: (params) => enqueue(() => prepared.run(params)),
      };
      return serial;
    },
    transaction: (fn) => enqueue(() => inner.transaction(fn)),
  };
}
