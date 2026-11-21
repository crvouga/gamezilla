import { expect, test } from 'bun:test';
import type {
  LogRecordExporter,
  ReadableLogRecord,
} from '@opentelemetry/sdk-logs';
import {
  AggregationTemporality,
  type PushMetricExporter,
  type ResourceMetrics,
} from '@opentelemetry/sdk-metrics';
import { createSignals } from '@pkgs/observability-runtime-shared-ts/signals';

function metricSink() {
  const exported: ResourceMetrics[] = [];
  const exporter: PushMetricExporter = {
    export: (metrics, done: (result: { code: number }) => void) => {
      exported.push(metrics);
      done({ code: 0 });
    },
    forceFlush: async () => {},
    shutdown: async () => {},
    selectAggregationTemporality: () => AggregationTemporality.CUMULATIVE,
  };
  return { exporter, exported };
}

const logSink: LogRecordExporter = {
  export: (
    _logs: ReadableLogRecord[],
    done: (result: { code: number }) => void
  ) => done({ code: 0 }),
  forceFlush: async () => {},
  shutdown: async () => {},
};

// regression: metrics-active-series-limit-drops-evidence
test("a Worker isolate stores none of the SDK's own metrics", async () => {
  const sink = metricSink();
  const runtime = createSignals(
    {
      serviceName: 'fixture',
      serviceVersion: '1',
      buildSha: 'fixture',
      environment: 'test',
      registerGlobal: false,
      metricExporter: sink.exporter,
      logExporter: logSink,
    },
    true
  );
  // The SDK times a collection after it, so the second export would carry it.
  await runtime.forceFlush();
  await runtime.forceFlush();
  await runtime.shutdown();
  const names = sink.exported.flatMap((batch) =>
    batch.scopeMetrics.flatMap((scope) =>
      scope.metrics.map((metric) => metric.descriptor.name)
    )
  );
  expect(names.filter((name) => name.startsWith('otel.'))).toEqual([]);
});
