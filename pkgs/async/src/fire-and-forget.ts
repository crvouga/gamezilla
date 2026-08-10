import { createLogger } from '@pkgs/logger/logger';

export type FireAndForgetOptions = {
  readonly now: () => number;
};

/**
 * Wraps a promise to log rejections with structured context instead of silently swallowing.
 * Use when intentionally not awaiting an async operation but still needing visibility on failures.
 *
 * Tiger Style: fire-and-forget must never hide errors. This helper ensures failures are
 * logged with context so they can be diagnosed. The caller accepts that the operation
 * may fail; we fail loudly in the log rather than silently.
 *
 * @param promise  - The promise to attach error handling to.
 * @param context  - Structured data for debugging (logged on rejection).
 * @param options  - Injected `now` for the structured logger.
 */
export function fireAndForget(
  promise: Promise<unknown>,
  context: Record<string, unknown>,
  options: FireAndForgetOptions
): void {
  const log = createLogger({ name: 'fire-and-forget', now: options.now });
  promise.catch((err: unknown) => {
    log.error('unhandled rejection', {
      ...context,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}
