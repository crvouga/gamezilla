import type {
  PreparedStatement,
  SqlClient,
} from '@pkgs/sql-client-root-shared-ts/interface';
import type { Sql, Value } from '@pkgs/sql-root-shared-ts/sql';
import { createTransactionChain } from './transaction-chain';

/** Single-connection reads and writes wait for whole transactions; their scoped handle bypasses this queue. */
export function createSerializedSqliteClient(
  connection: SqlClient,
  enqueue = createTransactionChain()
): SqlClient {
  const prepare = <T extends Record<string, unknown>>(
    query: Sql<T>
  ): PreparedStatement<T> => {
    let statement: PreparedStatement<T> | undefined;
    const get = () => (statement ??= connection.prepare(query));
    return {
      query: (params?: Value[]) => enqueue(() => get().query(params)),
      run: (params?: Value[]) => enqueue(() => get().run(params)),
    };
  };
  return {
    connect: () => connection.connect(),
    disconnect: () => connection.disconnect(),
    query: (query) => enqueue(() => connection.query(query)),
    run: (query) => enqueue(() => connection.run(query)),
    prepare,
    transaction: (fn) => enqueue(() => connection.transaction(fn)),
  };
}
