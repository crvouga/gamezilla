import { expect, test } from 'bun:test';
import type { Page } from '@playwright/test';
import { withSokobanTiming } from '../storybook/sokoban-timing-probe';
import {
  refuseTraceSnapshots,
  TRACE_SNAPSHOT_GLOBAL_PREFIX,
  timingTrace,
} from '../storybook/timing-trace';

// Evaluates the same self-contained functions Playwright sends to the browser.
const page = {
  evaluate: (callback: () => unknown) => Promise.resolve().then(callback),
} as unknown as Pick<Page, 'evaluate'>;

/** The global Playwright's trace DOM snapshotter installs in a traced page. */
async function withSnapshotter<T>(run: () => Promise<T>): Promise<T> {
  const key = `${TRACE_SNAPSHOT_GLOBAL_PREFIX}8a1f`;
  Object.assign(window, { [key]: {} });
  try {
    return await run();
  } finally {
    Reflect.deleteProperty(window, key);
  }
}

test('timing suites record traces without in-page DOM snapshots', () => {
  expect(timingTrace).toEqual({
    mode: 'on',
    snapshots: false,
    screenshots: true,
    sources: true,
  });
});

test('a page without the trace DOM snapshotter can be timed', () => {
  expect(refuseTraceSnapshots).not.toThrow();
});

// regression: timing-probes-measure-trace-snapshots
test('Sokoban timing refuses a page the trace DOM snapshotter instruments', async () => {
  const scope = window as unknown as { sokobanSamples?: unknown };
  let measured = false;
  const error = await withSnapshotter(() =>
    withSokobanTiming(page, () => {
      measured = true;
      return Promise.resolve();
    }).catch((reason: unknown) => reason)
  );
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toContain('timingTrace');
  expect(measured).toBe(false);
  expect(scope.sokobanSamples).toBeUndefined();
});
