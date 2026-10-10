import { afterEach, expect, test } from 'bun:test';
import { createRequestTelemetryMiddleware } from '@libs/app-root-server/request-telemetry';
import { context, metrics, propagation, trace } from '@opentelemetry/api';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
} from '@opentelemetry/sdk-metrics';
import {
  AlwaysOffSampler,
  InMemorySpanExporter,
} from '@opentelemetry/sdk-trace-base';
import { createWorkerTelemetry } from '@pkgs/observability-root-server/worker-worker';
import { Hono } from 'hono';

afterEach(() => {
  metrics.disable();
  trace.disable();
  propagation.disable();
  context.disable();
});

test('request counts and durations include failures and unsampled requests', async () => {
  const exporter = new InMemoryMetricExporter(
    AggregationTemporality.CUMULATIVE
  );
  const spans = new InMemorySpanExporter();
  const runtime = createWorkerTelemetry({
    serviceName: 'request-test',
    serviceVersion: '1',
    environment: 'test',
    buildSha: 'abc',
    exporter: spans,
    sampler: new AlwaysOffSampler(),
    metricExporter: exporter,
  });
  let now = 1000;
  const app = new Hono()
    .use(
      '*',
      createRequestTelemetryMiddleware(() => now)
    )
    .get('/ok', (c) => {
      now += 250;
      return c.json({ ok: true });
    })
    .get('/failure', (c) => {
      now += 500;
      return c.json({ error: true }, 503);
    });
  expect((await app.request('/ok')).status).toBe(200);
  expect((await app.request('/failure')).status).toBe(503);
  await runtime.forceFlush();
  expect(spans.getFinishedSpans()).toHaveLength(0);
  const data = exporter
    .getMetrics()
    .flatMap((r) => r.scopeMetrics.flatMap((s) => s.metrics));
  const counts = data.find((m) => m.descriptor.name === 'http.server.requests');
  expect(counts?.dataPoints.map((p) => p.value)).toEqual([1, 1]);
  expect(
    counts?.dataPoints.map((p) => p.attributes['app.http.status_class'])
  ).toEqual(['2xx', '5xx']);
  const durations = data.find(
    (m) => m.descriptor.name === 'http.server.request.duration'
  );
  expect(durations?.dataPoints.map((p) => p.value)).toMatchObject([
    { sum: 0.25, count: 1 },
    { sum: 0.5, count: 1 },
  ]);
  await runtime.shutdown();
});
