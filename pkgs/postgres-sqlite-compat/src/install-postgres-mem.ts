/**
 * Install SQLite JSON1-shaped functions on `@crvouga/postgres-mem`.
 * Reuses {@link sqliteJsonInstallStatementsForPostgresMem} from
 * `json-functions-sql.ts` (no duplicated DDL).
 */

import type { Database } from '@crvouga/postgres-mem';
import { sqliteJsonInstallStatementsForPostgresMem } from './json-functions-sql';

export type InstallPostgresMemSqliteCompatOptions = {
  readonly db: Database;
};

/**
 * Install SQLite JSON1 function names on a postgres-mem database.
 * Idempotent; call once at create time.
 */
export function installPostgresMemSqliteCompat(
  opts: InstallPostgresMemSqliteCompatOptions
): void {
  for (const statement of sqliteJsonInstallStatementsForPostgresMem()) {
    opts.db.exec(statement);
  }
}
