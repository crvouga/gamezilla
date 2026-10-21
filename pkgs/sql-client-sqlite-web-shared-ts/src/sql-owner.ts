import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';

/**
 * Backing store for a web (or test) SQLite owner tab.
 *
 * Browser owners keep sqlite-wasm in a dedicated worker so OPFS access handles
 * die with that realm, enabling in-process wipe without navigation.
 */
export type SqlOwner = {
  /** Open (or reopen) the named DB and return a connected {@link SqlClient}. */
  open: () => Promise<SqlClient>;
  /**
   * Release the live connection and any held handles (worker teardown, harness
   * access-handle release). Does not delete durable bytes by itself.
   */
  close: () => Promise<void>;
  /**
   * Drop held handles now, without a graceful close: the page is being
   * discarded or frozen into the back/forward cache, so no async close would
   * finish before the next page needs the store.
   */
  release: () => void;
  /** Wipe the backing store for this DB (and pool directory when applicable). */
  resetStore: () => Promise<void>;
};

export type SqlOwnerFactory = (args: { readonly dbName: string }) => SqlOwner;

/**
 * Errors that mean the cache is unusable and should be wiped then reopened.
 * Matches SAH pool exhaustion, corrupt files, and migration failures.
 */
export function isSqlOwnerWipeWorthyError(error: unknown): boolean {
  const message =
    error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return (
    /cannot create file/i.test(message) ||
    /SAH pool is full|SQLITE_FULL/i.test(message) ||
    /file is not a database/i.test(message) ||
    /not a database/i.test(message) ||
    /database disk image is malformed/i.test(message) ||
    /schema epoch/i.test(message) ||
    /migrateLocalSchema failed/i.test(message) ||
    /ensureDomainTables\/migrate/i.test(message)
  );
}
