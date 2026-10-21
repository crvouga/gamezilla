import { afterEach, expect, test } from 'bun:test';
import { createRequestTelemetryMiddleware } from '@libs/app-root-server-ts/request-telemetry';
import { context, metrics, propagation, trace } from '@opentelemetry/api';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
} from '@opentelemetry/sdk-metrics';
import {
  AlwaysOffSampler,
  InMemorySpanExporter,
} from '@opentelemetry/sdk-trace-base';
import { createWorkerTelemetry } from '@pkgs/observability-root-server-ts/worker-worker';
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

// regression: http-metrics-machine-traffic-unseparated
test('requests are counted by the route group that answered, with machine traffic apart', async () => {
  const exporter = new InMemoryMetricExporter(
    AggregationTemporality.CUMULATIVE
  );
  const runtime = createWorkerTelemetry({
    serviceName: 'request-test',
    serviceVersion: '1',
    environment: 'test',
    buildSha: 'abc',
    exporter: new InMemorySpanExporter(),
    sampler: new AlwaysOffSampler(),
    metricExporter: exporter,
  });
  const app = new Hono()
    .use(
      '*',
      createRequestTelemetryMiddleware(() => 0)
    )
    .post('/api/mutations', (c) => c.json({ ok: true }))
    .post('/api/synthetic-population-worker/claim', (c) => c.json({ ok: true }))
    .get('/api/tts/audio/:name', (c) => c.json({ ok: true }))
    .get('/api/something-new/:id', (c) => c.json({ ok: true }));
  for (const [method, path] of [
    ['POST', '/api/mutations'],
    ['POST', '/api/mutations'],
    ['POST', '/api/synthetic-population-worker/claim'],
    ['GET', '/api/tts/audio/abc'],
    ['GET', '/api/something-new/7'],
    ['GET', '/api/nothing-here'],
  ] as const) {
    await app.request(path, { method });
  }
  await runtime.forceFlush();
  const data = exporter
    .getMetrics()
    .flatMap((r) => r.scopeMetrics.flatMap((s) => s.metrics));
  const counts = data.find((m) => m.descriptor.name === 'http.server.requests');
  const byGroup = Object.fromEntries(
    (counts?.dataPoints ?? []).map((p) => [
      `${String(p.attributes['app.http.route_group'])} ${String(p.attributes['app.http.status_class'])}`,
      p.value,
    ])
  );
  expect(byGroup).toEqual({
    'sync 2xx': 2,
    'machine 2xx': 1,
    'media 2xx': 1,
    // A route no rule names, and a path nothing answers, count as people's.
    'app 2xx': 1,
    'app 4xx': 1,
  });
  await runtime.shutdown();
});
