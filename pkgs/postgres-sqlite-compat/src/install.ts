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
import { sql, unsafe } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SQLITE_JSON_INSTALL_STATEMENTS } from './json-functions-sql';

export type InstallPostgresSqliteCompatOptions = {
  readonly sqlClient: SqlClient;
};

/**
 * True when the client is not SQLite.
 * Uses portable `sqlite_version()` — succeeds only on SQLite; failure ⇒ Postgres
 * (or other). Avoids `pg_catalog` so probes work under agnostic SQL bans.
 */
export async function isPostgresSqlClient(
  sqlClient: SqlClient
): Promise<boolean> {
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
