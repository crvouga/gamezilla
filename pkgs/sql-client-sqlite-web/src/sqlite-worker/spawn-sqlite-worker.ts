// @io-wall-ok
import type { SqliteWorkerHandle } from './sqlite-worker-sql-owner';

/**
 * Browser spawner for the SQLite dedicated worker. Bundlers that understand
 * `new Worker(new URL(..., import.meta.url), { type: 'module' })` (Vite)
 * emit the worker chunk automatically.
 */
export function spawnSqliteWorker(dbName: string): SqliteWorkerHandle {
  return new Worker(new URL('./sqlite-worker-entry.ts', import.meta.url), {
    type: 'module',
    name: `sqlite:${dbName}`,
  });
}
