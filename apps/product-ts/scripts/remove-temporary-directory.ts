export const REMOVE_ATTEMPTS = 20;
export const REMOVE_RETRY_MS = 250;

export type RemovePorts = {
  readonly remove: (path: string) => void;
  readonly sleep: (ms: number) => Promise<void>;
  readonly warn: (message: string) => void;
};

/**
 * Deletes a directory a run made. Right after the stack stops, Windows still
 * holds the files of the processes that just exited (`EBUSY`) for a moment, and
 * a throw from here turned a run whose every scenario passed into exit code 1
 * (Verify run 40769518282, all three journey parts). The delay lets the locks
 * go; a directory that stays locked is left for the next job's checkout clean
 * and reported, because leftover temporary data is not a verdict on the
 * journeys.
 */
export async function removeTemporaryDirectory(
  path: string,
  ports: RemovePorts
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      ports.remove(path);
      return;
    } catch (error) {
      if (attempt === REMOVE_ATTEMPTS) {
        ports.warn(
          `::warning::Could not remove ${path} after ${String(REMOVE_ATTEMPTS)} attempts; the next job's checkout clean removes it: ${String(error)}`
        );
        return;
      }
      await ports.sleep(REMOVE_RETRY_MS);
    }
  }
}
