import type { SqlClient } from '@pkgs/sql-client/interface';

/**
 * Backing store for a web (or test) SQLite owner tab.
 *
 * Product web uses an iframe-hosted expo-sqlite owner so AccessHandlePoolVFS
 * handles die when the iframe is destroyed — enabling in-process OPFS wipe
 * without navigating the product Window away.
 */
export type SqlOwner = {
  /** Open (or reopen) the named DB and return a connected {@link SqlClient}. */
  open: () => Promise<SqlClient>;
  /**
   * Release the live connection and any held handles (iframe teardown, sim
   * access-handle release). Does not delete durable bytes by itself.
   */
  close: () => Promise<void>;
  /** Wipe the backing store for this DB (and pool directory when applicable). */
  resetStore: () => Promise<void>;
};

export type SqlOwnerFactory = (args: { readonly dbName: string }) => SqlOwner;

/**
 * Errors that mean the cache is unusable and should be wiped then reopened.
 * Matches AccessHandlePoolVFS exhaustion, corrupt files, and migrate failures.
 */
export function isSqlOwnerWipeWorthyError(error: unknown): boolean {
  const message =
    error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return (
    /cannot create file/i.test(message) ||
    /sqlite3_open_v2/i.test(message) ||
    /Timed out opening SQLite database/i.test(message) ||
    /file is not a database/i.test(message) ||
    /not a database/i.test(message) ||
    /database disk image is malformed/i.test(message) ||
    /schema epoch/i.test(message) ||
    /migrateLocalSchema failed/i.test(message) ||
    /ensureDomainTables\/migrate/i.test(message)
  );
}
