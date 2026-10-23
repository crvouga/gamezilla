import { recordStructuredLog } from '@pkgs/observability-root-shared-ts/log';

/** Report work that rejects after its request ended, then flush before the invocation expires. */
export async function observeBackgroundWork<T>(
  promise: Promise<T>,
  forceFlush: () => Promise<void>
): Promise<T> {
  try {
    return await promise;
  } catch (reason: unknown) {
    recordStructuredLog({
      severity: 'error',
      message: 'background task failed',
      loggerName: 'background',
      context: {
        error: reason instanceof Error ? reason : new Error(String(reason)),
      },
    });
    throw reason;
  } finally {
    // An exporter failure cannot replace the operation's own result or exception.
    await Promise.allSettled([Promise.resolve().then(forceFlush)]);
  }
}
