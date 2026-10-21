import { ATTR } from '@pkgs/observability-root-shared-ts/attributes';
import { startSpan } from '@pkgs/observability-root-shared-ts/span';

/** How often the page proves its event loop is free. */
export const STALL_PROBE_MS = 100;
/** A probe that arrives at least this late is recorded. */
export const STALL_THRESHOLD_MS = 100;

type StallTimers = {
  readonly setInterval: (fn: () => void, ms: number) => unknown;
  readonly clearInterval: (handle: unknown) => void;
};

type VisibilitySource = {
  readonly visibilityState: string;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
};

/**
 * One `main_thread.stall` span each time the page's event loop is held for
 * {@link STALL_THRESHOLD_MS} or longer: a probe scheduled every
 * {@link STALL_PROBE_MS} that arrives late means nothing else could run in
 * between. The span covers the time the probe was kept waiting, so it lines
 * up with the `interaction.timing` span of the input that felt slow.
 *
 * It exists because WebKit reports neither long tasks nor long animation
 * frames: there a slow interaction otherwise carries no sign of what held the
 * page. A hidden page throttles its timers, which would read as stalls, so
 * the watch only runs while the page is visible.
 */
export function installMainThreadStallWatch(args: {
  /** Epoch milliseconds. */
  readonly now: () => number;
  readonly timers: StallTimers;
  readonly document: VisibilitySource;
}): () => void {
  let handle: unknown = null;
  let expectedAt = 0;
  const probe = (): void => {
    const at = args.now();
    if (at - expectedAt >= STALL_THRESHOLD_MS) recordStall(expectedAt, at);
    expectedAt = at + STALL_PROBE_MS;
  };
  const stop = (): void => {
    if (handle === null) return;
    args.timers.clearInterval(handle);
    handle = null;
  };
  const start = (): void => {
    if (handle !== null) return;
    expectedAt = args.now() + STALL_PROBE_MS;
    handle = args.timers.setInterval(probe, STALL_PROBE_MS);
  };
  const follow = (): void => {
    if (args.document.visibilityState === 'visible') start();
    else stop();
  };
  args.document.addEventListener('visibilitychange', follow);
  follow();
  return () => {
    args.document.removeEventListener('visibilitychange', follow);
    stop();
  };
}

function recordStall(startMs: number, endMs: number): void {
  const span = startSpan(
    'main_thread.stall',
    { [ATTR.APP_MAIN_THREAD_STALL_MS]: Math.round(endMs - startMs) },
    { startTime: startMs }
  );
  span.end(endMs);
}
