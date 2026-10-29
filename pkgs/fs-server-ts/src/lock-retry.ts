export const LOCK_ATTEMPTS = 20;
export const LOCK_RETRY_MS = 250;

/**
 * What Windows answers while another process (one that just exited, a
 * scanner, an indexer, a concurrent reader) still holds a file the caller is
 * deleting or replacing. POSIX unlinks and replaces open files and never says
 * any of these, so only a Windows runner finds the bug.
 */
const LOCKED_CODES = new Set(['EBUSY', 'EPERM', 'EACCES', 'ENOTEMPTY']);

export function isLocked(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    LOCKED_CODES.has(String((error as { readonly code?: unknown }).code))
  );
}

/** Blocks the thread without spinning; a retry has nothing else to do. */
export function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
