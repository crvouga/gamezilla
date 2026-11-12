// @io-wall-ok — process-owned SQLite lock shared by every run on one localhost stack.
import { Database } from 'bun:sqlite';
import { stackManifestPath } from './stack-manifest';

const SLEEP_MS = 100;

function busy(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'SQLITE_BUSY'
  );
}

/**
 * Hold `name` across every run attached to this process's localhost stack
 * until the returned release is called; without a stack there is nothing to
 * share and the hold is free. The OS drops the lock if the holder dies, so a
 * crashed run never leaves it taken.
 */
export async function holdStackLock(
  name: string,
  maxWaitMs: number
): Promise<() => void> {
  const manifest = stackManifestPath();
  if (manifest === null) return () => undefined;
  const path = `${manifest}.${name}.lock.sqlite`;
  const db = new Database(path, { create: true });
  db.run('PRAGMA busy_timeout=0');
  for (let waited = 0; ; waited += SLEEP_MS) {
    try {
      db.run('BEGIN EXCLUSIVE');
      break;
    } catch (error) {
      if (!busy(error)) {
        db.close();
        throw error;
      }
    }
    if (waited >= maxWaitMs) {
      db.close();
      throw new Error(
        `waited ${String(maxWaitMs)}ms for another run to release ${name}`
      );
    }
    await new Promise<void>((resolve) => setTimeout(resolve, SLEEP_MS));
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    db.close();
  };
}
