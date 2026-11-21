import { afterEach, expect, test } from 'bun:test';
import { metrics } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
} from '@opentelemetry/sdk-metrics';
import { createMetric } from '@pkgs/observability-root-shared-ts/metric-contract';
import { OUTBOX_DRAIN_RUNS_METRIC } from '@pkgs/observability-root-shared-ts/outbox-metrics';
import { createSignals } from '@pkgs/observability-runtime-shared-ts/signals';

afterEach(() => {
  metrics.disable();
  logs.disable();
});

// regression: telemetry-sdk-self-metrics-per-writer
// Literal input: one Worker isolate's signals (instance `isolate-1`) count one
// drain run, write one log line and flush twice. Every series a writer exports is multiplied by
// every isolate and page, each with its own service.instance.id, and the
// metrics backend refused new series once the plan's active-series limit was
// reached; the SDK's own `otel.sdk.*` series were ones nobody reads.
test.each([true, false])(
  'a writer exports only the metrics the product declares (worker: %p)',
  async (worker) => {
    const exporter = new InMemoryMetricExporter(
      AggregationTemporality.CUMULATIVE
    );
    const runtime = createSignals(
      {
        serviceName: 'self-metrics-test',
        serviceVersion: '1',
        environment: 'dev',
        buildSha: 'abc',
        instanceId: 'isolate-1',
        metricExporter: exporter,
        logExporter: {
          export: (_records, callback) => callback({ code: 0 }),
          forceFlush: async () => {},
          shutdown: async () => {},
        },
      },
      worker
    );
    try {
      createMetric(OUTBOX_DRAIN_RUNS_METRIC)(1, { 'app.outcome': 'success' });
      logs.getLogger('self-metrics-test').emit({ body: 'drained' });
      await runtime.forceFlush();
      await runtime.forceFlush();
      const names = new Set(
        exporter
          .getMetrics()
          .flatMap((r) => r.scopeMetrics.flatMap((s) => s.metrics))
          .map((m) => m.descriptor.name)
      );
      expect([...names].sort()).toEqual([OUTBOX_DRAIN_RUNS_METRIC.name]);
    } finally {
      await runtime.shutdown();
    }
  }
);
