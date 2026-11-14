// @io-wall-ok — a trace test's Bun timeout, as a signal its replay stops at.

/** Past Bun's own timeout, so the test has already failed when it fires. */
const AFTER_BUN_MS = 1_000;

/**
 * A signal aborted once the trace's test has timed out (never, when the
 * binding sets no timeout), and `clear` for a replay that ended in time.
 */
export function traceTimeout(timeoutMs: number | undefined): {
  readonly signal: AbortSignal | undefined;
  clear(): void;
} {
  if (timeoutMs === undefined) return { signal: undefined, clear: () => {} };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs + AFTER_BUN_MS);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}
