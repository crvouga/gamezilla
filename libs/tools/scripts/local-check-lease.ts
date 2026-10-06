// @io-wall-ok — host-wide check admission, outside private worktree/temp directories.
import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { CheckLease } from './local-check-queue';

/** One lock per user on this machine, regardless of checkout or TMPDIR. */
export function localCheckLeasePath(home: string = homedir()): string {
  return join(home, '.cache/gamezilla/local-check.sqlite');
}

/**
 * SQLite's OS lock is released on connection close or process death. No PID
 * files to reclaim, stale-file deletion race, tables, or application data.
 * https://www.sqlite.org/lockingv3.html
 */
export function openLocalCheckLease(path: string): CheckLease {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { create: true });
  db.run('PRAGMA busy_timeout=0');
  return {
    tryAcquire() {
      try {
        db.run('BEGIN EXCLUSIVE');
        return true;
      } catch (error) {
        if ((error as { code?: string }).code === 'SQLITE_BUSY') return false;
        throw error;
      }
    },
    close() {
      db.close();
    },
  };
}
