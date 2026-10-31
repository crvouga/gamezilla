import { afterEach, expect, test } from 'bun:test';
import { metrics } from '@opentelemetry/api';
import { syncPerformanceEnabled } from '@pkgs/observability-root-shared-ts/metric-contract';
import { createSignals } from '@pkgs/observability-runtime-shared-ts/signals';

afterEach(() => metrics.disable());
const options = {
  serviceName: 'test',
  serviceVersion: '1',
  buildSha: 'test',
  environment: 'dev' as const,
  monotonicNow: () => 0,
};

test('a trace-only runtime does not enable performance database observations', async () => {
  const runtime = createSignals(options, true);
  try {
    expect(syncPerformanceEnabled()).toBe(false);
  } finally {
    await runtime.shutdown();
  }
});

test('a metrics runtime owns the performance recorder until shutdown', async () => {
  const runtime = createSignals(
    {
      ...options,
      metricExporter: {
        export: (_data, callback) => callback({ code: 0 }),
        forceFlush: async () => {},
        shutdown: async () => {},
      },
    },
    true
  );
  expect(syncPerformanceEnabled()).toBe(true);
  await runtime.shutdown();
  expect(syncPerformanceEnabled()).toBe(false);
});
