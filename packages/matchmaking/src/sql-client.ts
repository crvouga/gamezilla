/**
 * Minimal Postgres-flavored SQL port.
 *
 * Both `pg.Pool` and PGlite speak `$1` positional parameters and return
 * `{ rows: T[] }` natively, so a thin interface lets the library run
 * unchanged against either backend. The library never inspects driver
 * internals — only `.query()` and `.transaction()` are required.
 */

export type QueryResult<T> = {
  readonly rows: readonly T[];
};

export interface SqlClient {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<QueryResult<T>>;

  /**
   * Runs `fn` inside a transaction. The library only relies on this for
   * `SELECT ... FOR UPDATE SKIP LOCKED` followed by an `UPDATE` against the
   * same rows, so adapters must guarantee both statements share a single
   * connection.
   */
  transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T>;
}
