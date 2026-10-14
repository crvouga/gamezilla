// @io-wall-ok — process-owned SQLite locking for a harness seed cache.
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server/wall-node-fs';

const WAIT_SLICES = 600;
const SLEEP_MS = 50;

function busy(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'SQLITE_BUSY'
  );
}

async function acquire(db: Database, path: string): Promise<void> {
  for (let slice = 0; slice < WAIT_SLICES; slice++) {
    try {
      db.run('BEGIN EXCLUSIVE');
      return;
    } catch (error) {
      if (!busy(error)) throw error;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, SLEEP_MS));
  }
  throw new Error(`seed rebuild lock timed out waiting for ${path}`);
}

/** OS locks disappear on close or process death; there is no stale directory to delete. */
export async function withSeedRebuildLock<T>(
  cacheDir: string,
  seedKey: string,
  fn: () => Promise<T>
): Promise<T> {
  await wallNodeFs().mkdir(cacheDir, { recursive: true });
  const path = join(cacheDir, `${seedKey}.lock.sqlite`);
  const db = new Database(path, { create: true });
  try {
    db.run('PRAGMA busy_timeout=0');
    await acquire(db, path);
    return await fn();
  } finally {
    db.close();
  }
}
