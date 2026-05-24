/**
 * Dev-only performance counters / marks for the chess board pipeline.
 *
 * Used to diagnose hover dispatch rate, gesture recreation count, and render
 * churn while tuning mobile performance. All helpers no-op outside dev builds
 * and outside browsers that expose `performance.mark`. Safe to call from
 * worklets via `runOnJS`.
 */

const IS_DEV: boolean =
  typeof process !== 'undefined' &&
  (process as { env?: { NODE_ENV?: string } }).env?.NODE_ENV !== 'production';

const hasPerformance =
  typeof performance !== 'undefined' &&
  typeof performance.mark === 'function' &&
  typeof performance.measure === 'function';

export function markChessPerf(label: string): void {
  if (!IS_DEV || !hasPerformance) return;
  try {
    performance.mark(label);
  } catch {
    /* noop */
  }
}

export function measureChessPerf(
  name: string,
  start: string,
  end?: string
): void {
  if (!IS_DEV || !hasPerformance) return;
  try {
    if (end !== undefined) performance.measure(name, start, end);
    else performance.measure(name, start);
  } catch {
    /* noop */
  }
}

const counters: Map<string, number> = new Map();

export function bumpChessCounter(name: string): void {
  if (!IS_DEV) return;
  counters.set(name, (counters.get(name) ?? 0) + 1);
}

export function readChessCounter(name: string): number {
  if (!IS_DEV) return 0;
  return counters.get(name) ?? 0;
}

export function resetChessCounter(name: string): void {
  if (!IS_DEV) return;
  counters.delete(name);
}
