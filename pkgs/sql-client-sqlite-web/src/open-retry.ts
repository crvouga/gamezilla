import type { Timers } from '@pkgs/clock';

/** Fail fast instead of leaving Suspense on a hung OPFS / worker open. */
export const OPEN_DATABASE_TIMEOUT_MS = 25_000;

export async function withOpenTimeout<T>(
  databaseName: string,
  promise: Promise<T>,
  timers: Timers
): Promise<T> {
  let timeoutId: unknown | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = timers.setTimeout(() => {
      reject(
        new Error(
          `Timed out opening SQLite database "${databaseName}" after ${OPEN_DATABASE_TIMEOUT_MS}ms`
        )
      );
    }, OPEN_DATABASE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId !== undefined) timers.clearTimeout(timeoutId);
  }
}

/** Backoff for locked-handle opens: 250ms → 4s, ~15s total. */
export const WEB_OPEN_RETRY_DELAYS_MS = [
  250, 500, 1000, 2000, 4000, 4000, 3250,
] as const;

/** True lock contention on an existing OPFS sync access handle. */
export function isLikelyOpfsLockError(error: unknown): boolean {
  const message =
    error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return (
    /NoModificationAllowedError/i.test(message) ||
    /Access Handles|createSyncAccessHandle|locking/i.test(message)
  );
}

export async function sleepMs(timers: Timers, ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    timers.setTimeout(() => resolve(), ms);
  });
}

/**
 * Open with wait-and-retry on locked OPFS handles. Never deletes the DB file.
 */
export async function openWithWaitRetry<T>(args: {
  readonly databaseName: string;
  readonly timers: Timers;
  readonly openOnce: () => Promise<T>;
  readonly delaysMs?: readonly number[];
}): Promise<T> {
  const delays = args.delaysMs ?? WEB_OPEN_RETRY_DELAYS_MS;
  let lastError: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await withOpenTimeout(
        args.databaseName,
        args.openOnce(),
        args.timers
      );
    } catch (error: unknown) {
      lastError = error;
      if (attempt >= delays.length || !isLikelyOpfsLockError(error)) {
        throw error;
      }
      const delay = delays[attempt] ?? 4000;
      console.warn(
        `[sqlite-web] Open locked for "${args.databaseName}"; retrying in ${delay}ms (attempt ${attempt + 1}/${delays.length}).`,
        error
      );
      await sleepMs(args.timers, delay);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
