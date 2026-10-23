import { afterEach, expect, test } from 'bun:test';
import { countTruncatedQuery } from '@libs/app-root-server-ts/query-truncation';
import { context, metrics, propagation, trace } from '@opentelemetry/api';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
} from '@opentelemetry/sdk-metrics';
import { InMemorySpanExporter } from '@opentelemetry/sdk-trace-base';
import { createWorkerTelemetry } from '@pkgs/observability-root-server-ts/worker-worker';

afterEach(() => {
  metrics.disable();
  trace.disable();
  propagation.disable();
  context.disable();
});

test('a truncated snapshot is counted for the environment and logged by name only', async () => {
  const exporter = new InMemoryMetricExporter(
    AggregationTemporality.CUMULATIVE
  );
  const runtime = createWorkerTelemetry({
    serviceName: 'query-truncation-test',
    serviceVersion: '1',
    environment: 'staging',
    buildSha: 'abc',
    exporter: new InMemorySpanExporter(),
    metricExporter: exporter,
  });
  const warnings: unknown[] = [];
  const count = countTruncatedQuery({
    warn: (message, fields) => warnings.push({ message, fields }),
  });
  count({ queryName: 'inboxItems', limit: 2000 });
  count({ queryName: 'inboxItems', limit: 2000 });
  await runtime.forceFlush();
  const points = exporter
    .getMetrics()
    .flatMap((r) => r.scopeMetrics.flatMap((s) => s.metrics))
    .find((m) => m.descriptor.name === 'sync.query.truncations')
    ?.dataPoints.map((p) => ({ value: p.value, attributes: p.attributes }));
  expect(points).toEqual([
    { value: 2, attributes: { 'deployment.environment.name': 'staging' } },
  ]);
  expect(warnings).toEqual([
    {
      message: 'query snapshot truncated at its limit',
      fields: { queryName: 'inboxItems', limit: 2000 },
    },
    {
      message: 'query snapshot truncated at its limit',
      fields: { queryName: 'inboxItems', limit: 2000 },
    },
  ]);
  await runtime.shutdown();
});
