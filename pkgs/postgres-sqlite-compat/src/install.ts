/**
 * Install Postgres shims that mimic SQLite APIs so shared SQL can target
 * one dialect on both engines.
 *
 * No-ops on non-Postgres engines (e.g. SQLite already has JSON1).
 *
 * Call with a raw engine client (not SqlClientImplAgnostic): install DDL is
 * Postgres-vendor by nature. Application DML should use an agnostic wrapper
 * afterward.
 */

import { assert } from '@pkgs/assert';
import { type Sql, sql, unsafe } from '@pkgs/sql';
import { SQLITE_JSON_INSTALL_STATEMENTS } from './json-functions-sql';

/**
 * Query/run surface for the installer. Structural so this package stays a
 * leaf — any `@pkgs/sql-client` `SqlClient` satisfies it.
 */
export type PostgresSqliteCompatSqlClient = {
  query<T extends Record<string, unknown>>(query: Sql<T>): Promise<T[]>;
  run(query: Sql<unknown>): Promise<unknown>;
  /** Postgres clients expose dbScope; SQLite clients do not. */
  readonly dbScope?: unknown;
};

export type InstallPostgresSqliteCompatOptions = {
  readonly sqlClient: PostgresSqliteCompatSqlClient;
};

/**
 * True when the client is not SQLite.
 *
 * Raw Postgres clients expose `dbScope`, so normal startup avoids sending a
 * deliberately invalid SQLite function to Postgres (which logs an ERROR).
 * The fallback keeps this leaf usable with third-party structural clients.
 */
export async function isPostgresSqlClient(
  sqlClient: PostgresSqliteCompatSqlClient
): Promise<boolean> {
  if (sqlClient.dbScope !== undefined) return true;
  try {
    await sqlClient.query(sql<{ v: string }>`SELECT sqlite_version() AS v`);
    return false;
  } catch {
    return true;
  }
}

/**
 * Idempotent install of the current compat surface (JSON1 v1).
 * Safe to re-run. No-op when the client is not Postgres (SQLite already
 * exposes JSON1 natively). On Postgres, uses `CREATE OR REPLACE`.
 */
export async function installPostgresSqliteCompat(
  opts: InstallPostgresSqliteCompatOptions
): Promise<void> {
  assert.defined(opts, 'installPostgresSqliteCompat: options required');
  assert.defined(
    opts.sqlClient,
    'installPostgresSqliteCompat: sqlClient required'
  );
  if (!(await isPostgresSqlClient(opts.sqlClient))) {
    return;
  }
  for (const statement of SQLITE_JSON_INSTALL_STATEMENTS) {
    await opts.sqlClient.run(unsafe(statement));
  }
}
