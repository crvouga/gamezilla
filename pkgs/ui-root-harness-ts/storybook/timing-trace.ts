// @io-wall-ok — browser timing evidence settings, never product timing.

/**
 * Trace options for a suite that times the page.
 *
 * Playwright's trace DOM snapshotter runs in the page's own main world: it
 * observes every DOM mutation and, before and after each traced action (key
 * presses, pointer moves, `evaluate`, locator reads), walks the whole document
 * reading `scrollTop` and `scrollLeft`, which forces style and layout. Under
 * CPU throttling those snapshots land as long tasks and late frames that the
 * long-task and frame budgets would charge to the game. The trace keeps its
 * actions, console, network, sources and screencast; only the in-page DOM
 * snapshots are off.
 */
export const timingTrace = {
  mode: 'on',
  snapshots: false,
  screenshots: true,
  sources: true,
} as const;

/** Global the trace DOM snapshotter installs in every page it instruments. */
export const TRACE_SNAPSHOT_GLOBAL_PREFIX = '__playwright_snapshot_streamer_';

/**
 * Refuses to time a page the trace DOM snapshotter instruments, so a timing
 * suite recorded with `trace: 'on'` fails at once with the reason instead of
 * now and then charging a snapshot to the game. Self-contained because
 * Playwright serializes this function into the page.
 */
export function refuseTraceSnapshots() {
  const snapshotter = Object.keys(window).find((key) =>
    key.startsWith('__playwright_snapshot_streamer_')
  );
  if (snapshotter)
    throw new Error(
      `Playwright trace DOM snapshots (${snapshotter}) run on this page's main thread and would be timed as the game's work; record this suite with timingTrace from storybook/timing-trace.ts`
    );
}
