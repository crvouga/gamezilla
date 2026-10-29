// @io-wall-ok
import { renameSync } from 'node:fs';
import {
  isLocked,
  LOCK_ATTEMPTS,
  LOCK_RETRY_MS,
  sleepSync,
} from './lock-retry';

export const RENAME_ATTEMPTS = LOCK_ATTEMPTS;

export type RenamePorts = {
  readonly rename: (from: string, to: string) => void;
  readonly sleep: (ms: number) => void;
};

const WALL_PORTS: RenamePorts = { rename: renameSync, sleep: sleepSync };

/**
 * Moves `from` onto `to`, waiting out the locks Windows puts on a destination
 * (or source) another process has open. POSIX replaces atomically whatever a
 * reader holds; Windows answers `EPERM`/`EACCES`/`EBUSY`, so a publish that
 * is "write a temp file, rename it into place" fails only on a Windows runner
 * while a concurrent reader is looking at the old file. Every `renameSync` in
 * the repository goes through here (`no-bare-rename-sync.grit`). A lock that
 * outlasts every attempt, and any other failure, is thrown.
 */
export function renameReplacing(
  from: string,
  to: string,
  ports: RenamePorts = WALL_PORTS
): void {
  for (let attempt = 1; ; attempt++) {
    try {
      ports.rename(from, to);
      return;
    } catch (error) {
      if (!isLocked(error) || attempt === RENAME_ATTEMPTS) throw error;
      ports.sleep(LOCK_RETRY_MS);
    }
  }
}
