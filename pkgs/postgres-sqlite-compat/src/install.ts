/**
 * Install Postgres shims that mimic SQLite APIs so shared SQL can target
 * one dialect on both engines.
 */

import { assert } from '@pkgs/assert';
import { unsafe } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SQLITE_JSON_INSTALL_STATEMENTS } from './json-functions-sql';

export type InstallPostgresSqliteCompatOptions = {
  readonly sqlClient: SqlClient;
};

/**
 * Idempotent install of the current compat surface (JSON1 v1).
 * Safe to re-run. No-op on already-installed function bodies via
 * `CREATE OR REPLACE`.
 */
export async function installPostgresSqliteCompat(
  opts: InstallPostgresSqliteCompatOptions
): Promise<void> {
  assert.defined(opts, 'installPostgresSqliteCompat: options required');
  assert.defined(
    opts.sqlClient,
    'installPostgresSqliteCompat: sqlClient required'
  );
  for (const statement of SQLITE_JSON_INSTALL_STATEMENTS) {
    await opts.sqlClient.run(unsafe(statement));
  }
}
