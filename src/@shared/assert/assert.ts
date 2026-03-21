import { crashBrowser, isBrowser } from './crash-browser';
import { crashFallback } from './crash-fallback';
import { crashNode, isNode } from './crash-node';

/**
 * Asserts that a condition is true. If false, logs details and crashes the process
 * (Node.js/server) or poisons the page (browser). Uses the `asserts` return type
 * for TypeScript type narrowing downstream.
 *
 * This is for **tiger-style programming**: fail fast and loudly. When an invariant
 * is violated, the program stops immediately rather than continuing in an invalid
 * state. Use for conditions that must never be false in correct code.
 *
 * @param condition - The condition to assert.
 * @param message   - Human-readable description of the invariant.
 * @param context   - Optional structured data for debugging (logged before crash).
 * @throws {{ __assertion_failure: true, message: string, context?: unknown }}
 */
export function assert(
  condition: boolean,
  message: string,
  context?: Record<string, unknown>
): asserts condition {
  if (condition) return;

  log(message, context);

  if (isNode()) {
    crashNode(message, context);
    return;
  }

  if (isBrowser()) {
    crashBrowser(message, context);
    return;
  }

  crashFallback(message, context);
}

function log(message: string, context?: Record<string, unknown>) {
  console.error('[ASSERT]', message);
  if (context !== undefined) console.error('[CONTEXT]', context);
  console.error(new Error().stack);
}
