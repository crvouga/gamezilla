// @io-wall-ok
import { rmSync } from 'node:fs';
import {
  isLocked,
  LOCK_ATTEMPTS,
  LOCK_RETRY_MS,
  sleepSync,
} from './lock-retry';

export const REMOVE_ATTEMPTS = LOCK_ATTEMPTS;

export type RemoveTreePorts = {
  readonly remove: (path: string) => void;
  readonly sleep: (ms: number) => void;
  readonly warn: (message: string) => void;
};

export type RemoveTreeOptions = {
  /**
   * What a tree that stays locked after every attempt means. `throw` (the
   * default) is for a tree the caller is about to rebuild or read: leftovers
   * would change its result. `leave` is for temporary data a run is finished
   * with: it is reported as a warning annotation and left for the next job's
   * checkout clean, because leftover scratch is not a verdict on the run.
   */
  readonly whenLocked?: 'throw' | 'leave';
  readonly ports?: RemoveTreePorts;
};

const WALL_PORTS: RemoveTreePorts = {
  remove: (path) => rmSync(path, { recursive: true, force: true }),
  sleep: sleepSync,
  warn: (message) => console.warn(message),
};

/**
 * Deletes a file or directory tree, waiting out the locks Windows holds on
 * files of processes that only just stopped. Every recursive delete in the
 * repository goes through here (`no-bare-recursive-rm.grit`): a bare `rmSync`
 * turned a run whose every scenario passed into exit code 1 (Verify run
 * 40769518282, all three release journey parts). A missing path is not an
 * error. Any failure that is not a lock is thrown at once.
 */
export function removeTree(
  path: string,
  options: RemoveTreeOptions = {}
): void {
  const ports = options.ports ?? WALL_PORTS;
  for (let attempt = 1; ; attempt++) {
    try {
      ports.remove(path);
      return;
    } catch (error) {
      if (!isLocked(error)) throw error;
      if (attempt < REMOVE_ATTEMPTS) {
        ports.sleep(LOCK_RETRY_MS);
        continue;
      }
      if (options.whenLocked !== 'leave') throw error;
      ports.warn(
        `::warning::Could not remove ${path} after ${String(REMOVE_ATTEMPTS)} attempts; the next job's checkout clean removes it: ${String(error)}`
      );
      return;
    }
  }
}
