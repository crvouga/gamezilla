// @io-wall-ok
import type { SqliteWorkerHandle } from '@pkgs/sql-client-sqlite-web-shared/sqlite-worker-sql-owner';

export const DEFAULT_SQLITE_WORKER_URL = '/sql-workers/sqlite-worker.js';

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
