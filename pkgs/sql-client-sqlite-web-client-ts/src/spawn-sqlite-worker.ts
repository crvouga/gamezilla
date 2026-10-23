// @io-wall-ok

import type { SqliteWorkerHandle } from '@pkgs/sql-client-sqlite-web-shared-ts/sqlite-worker-sql-owner';
import { SQLITE_WORKER_URL } from '@pkgs/sql-client-sqlite-web-shared-ts/sqlite-worker-url';

export const DEFAULT_SQLITE_WORKER_URL = SQLITE_WORKER_URL;

/** Assets are emitted by the `sqliteWebAssets` Vite plugin, not the app bundle. */
export function spawnSqliteWorker(
  dbName: string,
  workerUrl = DEFAULT_SQLITE_WORKER_URL
): SqliteWorkerHandle {
  return new Worker(workerUrl, {
    type: 'module',
    name: `sqlite:${dbName}`,
  });
}
