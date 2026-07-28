/**
 * Basic interface for a SQL database client.
 * Implementations should provide methods to connect, disconnect, and execute queries.
 *
 * All implementations use `?` for positional parameters. Pass params as an array
 * in order: `query("SELECT * FROM t WHERE id = ?", [1])`.
 */

import { assert } from '@pkgs/assert';
import type { PostgresDbScope } from './postgres/schema';

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

export interface PreparedStatement {
  query<T = Record<string, unknown>>(params?: unknown[]): Promise<T[]>;
  run(params?: unknown[]): Promise<RunResult>;
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
   * Executes a SELECT query and returns rows.
   * @param sql The SQL query string.
   * @param params Optional parameters for the query.
   * @returns Array of result rows.
   */
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]>;

  /**
   * Executes an INSERT, UPDATE, or DELETE statement.
   * @param sql The SQL statement string.
   * @param params Optional parameters for the statement.
   * @returns The number of changes and the last inserted row ID.
   */
  run(sql: string, params?: unknown[]): Promise<RunResult>;

  /**
   * Executes a function within a transaction.
   * Rolls back automatically on error.
   * @param fn Function to run with a transaction-scoped client.
   * @returns The result of the function.
   */
  transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T>;

  /**
   * Prepares a statement for execution.
   * @param sql The SQL statement string.
   * @returns A prepared statement.
   */
  prepare(sql: string): PreparedStatement;
}

/**
 * A {@link SqlClient} backed by Postgres whose session is pinned to a known
 * {@link PostgresDbScope}. The scope travels with the client so DDL/catalog
 * code can qualify by `dbScope.schema` instead of hardcoding `public`.
 */
export interface PostgresSqlClient extends SqlClient {
  readonly dbScope: PostgresDbScope;
}

export function assertQuery(
  sql: string,
  sqlClient: SqlClient
): asserts sql is string {
  assert.notThrows(() => sqlClient.prepare(sql), 'Invalid SQL query', { sql });
}
