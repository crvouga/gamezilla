import type { Timers } from '@pkgs/clock-shared/types';
import type { Logger } from '@pkgs/logger-shared/logger';

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

/**
 * True lock contention on an existing OPFS sync access handle: another
 * context, usually the worker of the page this one replaced, still holds the
 * file. Chromium says `NoModificationAllowedError`; WebKit says
 * `InvalidStateError`, "The object is in an invalid state." The error may
 * have crossed a worker boundary and kept only its message.
 */
export function isLikelyOpfsLockError(error: unknown): boolean {
  const message =
    error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return (
    /NoModificationAllowedError/i.test(message) ||
    /InvalidStateError|object is in an invalid state/i.test(message) ||
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
  /** Receives one warning per locked-handle retry. */
  readonly logger: Logger;
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
      args.logger.warn('open locked; retrying', {
        databaseName: args.databaseName,
        delayMs: delay,
        attempt: attempt + 1,
        attempts: delays.length,
        error: String(error),
      });
      await sleepMs(args.timers, delay);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
