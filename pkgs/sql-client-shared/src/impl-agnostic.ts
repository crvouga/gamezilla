/**
 * SqlClient decorator that refuses non-portable (vendor) SQL before delegating.
 * Use in dual-engine tests and harness so SQLite-shaped SQL is the dialect of record.
 *
 * Compat install must run against {@link getUnderlyingSqlClient} — shim DDL is
 * intentionally vendor SQL.
 */
import type { Sql } from '@pkgs/sql-shared/sql';
import { assertAgnosticSql } from './agnostic-sql';
import type { PreparedStatement, RunResult, SqlClient } from './interface';

export class SqlClientImplAgnostic implements SqlClient {
  constructor(private readonly client: SqlClient) {}

  /** Raw engine client for vendor-only bootstrap (compat install, PRAGMA). */
  getUnderlyingClient(): SqlClient {
    return this.client instanceof SqlClientImplAgnostic
      ? this.client.getUnderlyingClient()
      : this.client;
  }

  connect(): Promise<void> {
    return this.client.connect();
  }

  disconnect(): Promise<void> {
    return this.client.disconnect();
  }

  async query<T extends Record<string, unknown>>(query: Sql<T>): Promise<T[]> {
    assertAgnosticSql(query.sql);
    return this.client.query(query);
  }

  async run(query: Sql<unknown>): Promise<RunResult> {
    assertAgnosticSql(query.sql);
    return this.client.run(query);
  }

  prepare<T extends Record<string, unknown>>(
    query: Sql<T>
  ): PreparedStatement<T> {
    assertAgnosticSql(query.sql);
    return this.client.prepare(query);
  }

  async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    return this.client.transaction(async (tx) => {
      const wrapped = new SqlClientImplAgnostic(tx);
      return fn(wrapped);
    });
  }
}

/** Resolve the raw engine client through any agnostic wrappers. */
export function getUnderlyingSqlClient(client: SqlClient): SqlClient {
  return client instanceof SqlClientImplAgnostic
    ? client.getUnderlyingClient()
    : client;
}
