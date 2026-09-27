import { expect, test } from 'bun:test';

import {
  createLazyPerfSampler,
  type PerfListener,
  type PerfSampler,
} from '@libs/client-app/shell/create-lazy-perf-sampler';

// regression: eager-perf-sampler-bundle — disabled diagnostics must not load
// web-vitals and the browser sampler into the critical client boot path.
test('loads and starts the sampler only when enabled', async () => {
  const events: string[] = [];
  let resolveLoad!: (sampler: PerfSampler) => void;
  const loaded = new Promise<PerfSampler>((resolve) => {
    resolveLoad = resolve;
  });
  const inner: PerfSampler = {
    start: () => events.push('start'),
    stop: () => events.push('stop'),
    getSnapshot: () => ({
      fps: 60,
      slowFramePct: 0,
      frozenFramePct: 0,
      longTaskCount: 0,
      maxLongTaskMs: 0,
      inpMs: null,
      inpTarget: null,
      longestScript: null,
      lcpMs: null,
      cls: null,
      heapMb: null,
    }),
    subscribe: (listener: PerfListener) => {
      events.push('subscribe');
      listener(inner.getSnapshot());
      return () => events.push('unsubscribe');
    },
  };
  let loadCount = 0;
  const sampler = createLazyPerfSampler(() => {
    loadCount += 1;
    return loaded;
  });
  const snapshots: number[] = [];
  const unsubscribe = sampler.subscribe((snapshot) => {
    snapshots.push(snapshot.fps);
  });

  expect(loadCount).toBe(0);
  expect(sampler.getSnapshot().fps).toBe(0);

  sampler.start();
  expect(loadCount).toBe(1);
  resolveLoad(inner);
  await loaded;
  await Promise.resolve();

  expect(events).toEqual(['subscribe', 'start']);
  expect(snapshots).toEqual([60]);
  expect(sampler.getSnapshot().fps).toBe(60);

  sampler.stop();
  unsubscribe();
  expect(events).toEqual(['subscribe', 'start', 'stop', 'unsubscribe']);
});
