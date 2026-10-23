/**
 * Install SQLite JSON1-shaped functions on `@crvouga/mockingbird-service-postgres`.
 * Reuses {@link sqliteJsonInstallStatementsForMockingbirdPostgres} from
 * `json-functions-sql.ts` (no duplicated DDL).
 */

import type { Database } from '@crvouga/mockingbird-service-postgres';
import { sqliteJsonInstallStatementsForMockingbirdPostgres } from './json-functions-sql';

export type InstallMockingbirdPostgresSqliteCompatOptions = {
  readonly db: Database;
};

/**
 * Install SQLite JSON1 function names on a mockingbird-postgres database.
 * Idempotent; call once at create time.
 */
export function installMockingbirdPostgresSqliteCompat(
  opts: InstallMockingbirdPostgresSqliteCompatOptions
): void {
  for (const statement of sqliteJsonInstallStatementsForMockingbirdPostgres()) {
    opts.db.exec(statement);
  }
}
