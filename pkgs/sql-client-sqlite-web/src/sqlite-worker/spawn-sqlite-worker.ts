// @io-wall-ok
import type { SqliteWorkerHandle } from './sqlite-worker-sql-owner';

export const DEFAULT_SQLITE_WORKER_URL = '/sql-workers/sqlite-worker.js';

/** Assets are emitted by build:web-workers, independently of the app bundler. */
export function spawnSqliteWorker(
  dbName: string,
  workerUrl = DEFAULT_SQLITE_WORKER_URL
): SqliteWorkerHandle {
  return new Worker(workerUrl, {
    type: 'module',
    name: `sqlite:${dbName}`,
  });
}
