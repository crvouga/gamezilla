// @io-wall-ok — one cross-process rebuild of a harness seed. Waiters sleep on the wall.
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server/wall-node-fs';

const WAIT_SLICES = 600;
const SLEEP_MS = 50;

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function acquire(db: Database, path: string): Promise<void> {
  for (let slice = 0; slice < WAIT_SLICES; slice++) {
    try {
      db.run('BEGIN EXCLUSIVE');
      return;
    } catch (error) {
      if ((error as { code?: string }).code !== 'SQLITE_BUSY') throw error;
    }
    await pause(SLEEP_MS);
  }
  throw new Error(`seed rebuild lock timed out waiting for ${path}`);
}

/** SQLite's OS lease is released on close or process death, without unlink races. */
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
