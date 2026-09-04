/**
 * Basic interface for a SQL database client.
 * Implementations should provide methods to connect, disconnect, and execute queries.
 *
 * All implementations use `?` for positional parameters. Pass a {@link Sql}
 * instance from `@pkgs/sql` (`sql` / `join` / `bulk` / `raw`); drivers unpack
 * `query.sql` + `query.values`. Row types come from `Sql<T>` — do not restate
 * generics on `query` / `prepare` call sites.
 */

import { assert } from '@pkgs/assert';
import type { Sql, Value } from '@pkgs/sql';
import type { PostgresDbScope } from './postgres-db-scope';

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

export interface PreparedStatement<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  query(params?: Value[]): Promise<T[]>;
  run(params?: Value[]): Promise<RunResult>;
}

export interface SqlClient {
  /**
   * Establishes a connection to the database.
   */
  connect(): Promise<void>;

  /**
   * Closes the connection to the database.
   */
  disconnect(): Promise<void>;

  /**
   * Executes a SELECT query and returns rows typed from `Sql<T>`.
   */
  query<T extends Record<string, unknown>>(query: Sql<T>): Promise<T[]>;

  /**
   * Executes an INSERT, UPDATE, or DELETE statement.
   */
  run(query: Sql<unknown>): Promise<RunResult>;

  /**
   * Executes a function within a transaction.
   * Rolls back automatically on error.
   */
  transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T>;

  /**
   * Prepares a statement for execution.
   * Statement text comes from `query.sql`; bind values at execute via params.
   * Row type `T` is taken from `Sql<T>`.
   */
  prepare<T extends Record<string, unknown>>(
    query: Sql<T>
  ): PreparedStatement<T>;
}

/**
 * Query/run handle usable inside or outside a transaction.
 * Layer C (repositories / services / publishers) takes this — never a full
 * {@link SqlClient}. Both the request client and a `transaction` callback
 * handle satisfy it.
 */
export type SqlTx = Pick<SqlClient, 'query' | 'run'>;

/**
 * A {@link SqlClient} backed by Postgres whose session is pinned to a known
 * {@link PostgresDbScope}. The scope travels with the client so DDL/catalog
 * code can qualify by `dbScope.schema` instead of hardcoding `public`.
 */
export interface PostgresSqlClient extends SqlClient {
  readonly dbScope: PostgresDbScope;
}

export function assertQuery(
  query: Sql<unknown>,
  sqlClient: SqlClient
): asserts query is Sql<unknown> {
  assert.notThrows(
    () => sqlClient.prepare(query as Sql<Record<string, unknown>>),
    'Invalid SQL query',
    {
      sql: query.sql,
    }
  );
}
