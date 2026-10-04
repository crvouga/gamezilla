import type { CrashHandler } from './crash-handler';
import { FallbackCrashHandler } from './crash-handler-default';

const handlers: CrashHandler[] = [];

/**
 * Register a crash handler. Lower {@link CrashHandler.priority} is consulted first.
 *
 * @returns Disposer to remove this handler.
 */
export function registerCrashHandler(handler: CrashHandler): () => void {
  handlers.push(handler);
  handlers.sort((a, b) => a.priority - b.priority);
  return () => {
    const i = handlers.indexOf(handler);
    if (i >= 0) handlers.splice(i, 1);
  };
}

function dispatchCrash(
  message: string,
  context?: Record<string, unknown>
): void {
  for (const h of handlers) {
    if (h.match()) {
      h.crash(message, context);
      return;
    }
  }
  new FallbackCrashHandler().crash(message, context);
}

/**
 * Fails an invariant by handing it to the first matching {@link CrashHandler}.
 *
 * Never logs on its own: the handler owns the failure's surface (a thrown
 * error the caller or test runner reports, a fatal overlay, a process exit
 * that prints first). Logging here as well would print every expected
 * failure — `expect(() => …).toThrow()` included — into test output.
 */
export function crash(
  condition: boolean,
  message: string,
  context?: Record<string, unknown>
): asserts condition {
  if (condition) return;
  dispatchCrash(message, context);
}
