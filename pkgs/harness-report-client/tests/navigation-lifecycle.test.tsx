import { expect, test } from 'bun:test';
import { ClockProvider } from '@pkgs/clock-client/solid';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import type { ReportNavigation } from '@pkgs/harness-report-client/navigation';
import {
  type ReportNav,
  useReportNav,
} from '@pkgs/harness-report-client/use-report-nav';
import { render } from 'solid-js/web';

// regression: report-viewer-leaked-timer
test('each viewer releases its listeners and pending hash writes when unmounted', () => {
  const { clock, timers } = createHarnessClock();
  const listeners = new Set<() => void>();
  const writes: string[] = [];
  const subscribe = () => {
    const listener = () => undefined;
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const navigation: ReportNavigation = {
    readHash: () => '#/list',
    writeHash: (hash) => {
      writes.push(hash);
    },
    subscribeHash: subscribe,
    subscribeKeys: subscribe,
    setTitle: () => undefined,
  };
  let nav: ReportNav | undefined;
  function Viewer() {
    nav = useReportNav(
      {
        title: 'Example',
        runId: '1',
        updatedAtMs: 0,
        status: 'skipped',
        tests: [],
      },
      navigation
    );
    return null;
  }
  const host = document.createElement('div');
  const dispose = render(
    () => (
      <ClockProvider clock={clock} timers={timers}>
        <Viewer />
      </ClockProvider>
    ),
    host
  );
  expect(listeners.size).toBe(2);
  nav?.navigate({ view: 'list', params: { q: 'counter' } }, true);
  expect(clock.pendingOneShotCount()).toBe(1);
  dispose();
  expect(listeners.size).toBe(0);
  expect(clock.pendingOneShotCount()).toBe(0);
  clock.advance(200);
  expect(writes).toEqual([]);
});
