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
 */
export function fireAndForget(
  promise: Promise<unknown>,
  context: Record<string, unknown>
): void {
  promise.catch((err: unknown) => {
    console.error('[fire-and-forget] Unhandled rejection', context);
    console.error(err);
  });
}
