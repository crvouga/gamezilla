import { Oo1SqlClient, openMemoryDb } from './oo1-sql-client';
import type { Sqlite3Static } from './oo1-sql-client';
import type { SqliteWorkerBackend } from './sqlite-worker-host';

export const MEMORY_VFS_NAME = 'memdb';

/**
 * Non-persistent backend: every `open` starts from an empty `:memory:`
 * database. Used by tests and as the browser fallback when OPFS is unavailable.
 */
export function createMemorySqliteWorkerBackend(
  sqlite3: Sqlite3Static
): SqliteWorkerBackend {
  return {
    open: () =>
      Promise.resolve({
        db: new Oo1SqlClient({
          sqlite3,
          db: openMemoryDb(sqlite3),
          reopenFromBytes: (bytes) =>
            Promise.resolve(openMemoryDb(sqlite3, bytes)),
        }),
        persistent: false,
        vfs: MEMORY_VFS_NAME,
      }),
    wipe: () => Promise.resolve(),
  };
}
