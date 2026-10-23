import { afterEach, expect, test } from 'bun:test';
import { context, metrics, propagation, trace } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { InMemoryLogRecordExporter } from '@opentelemetry/sdk-logs';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
} from '@opentelemetry/sdk-metrics';
import {
  AlwaysOffSampler,
  InMemorySpanExporter,
} from '@opentelemetry/sdk-trace-base';
import { createWorkerTelemetry } from '@pkgs/observability-root-server-ts/worker-worker';
import { emitBusinessEvent } from '@pkgs/observability-root-shared-ts/business-event';
import {
  defineEvent,
  validateEvent,
} from '@pkgs/observability-root-shared-ts/event-contract';
import { recordStructuredLog } from '@pkgs/observability-root-shared-ts/log';
import { createMetric } from '@pkgs/observability-root-shared-ts/metric-contract';
import { withSpan } from '@pkgs/observability-root-shared-ts/span';

const contract = defineEvent({
  name: 'example.game.completed',
  version: 1,
  owner: 'example',
  description: 'A game reached its terminal state.',
  delivery: 'reliable',
  attributes: {
    'game.id': { type: 'string', required: true },
    'game.mode': {
      type: 'string',
      required: true,
      values: ['multiplayer', 'bot'],
    },
    'game.duration_ms': { type: 'number', required: true, minimum: 0 },
  },
});
const payload = {
  'game.id': 'game-1',
  'game.mode': 'bot',
  'game.duration_ms': 100,
} as const;
const envelope = {
  id: 'game-1:completed',
  occurredAtMs: 1000,
  synthetic: false,
};
const base = {
  serviceName: 'example',
  serviceVersion: '1',
  environment: 'test',
  buildSha: 'abc',
};

afterEach(() => {
  trace.disable();
  context.disable();
  propagation.disable();
  metrics.disable();
  logs.disable();
});

// regression: otel-log-record-getters-lost
// regression: otel-event-time-relative
test('named events survive trace sampling and retain correlation and event time', async () => {
  const exporter = new InMemoryLogRecordExporter();
  const spans = new InMemorySpanExporter();
  const runtime = createWorkerTelemetry({
    ...base,
    exporter: spans,
    sampler: new AlwaysOffSampler(),
    logExporter: exporter,
    eventContracts: [contract],
  });
  await withSpan('example.complete', () => {
    expect(emitBusinessEvent(contract, payload, envelope)).toBe(true);
  });
  await runtime.forceFlush();
  const records = exporter.getFinishedLogRecords();
  expect(spans.getFinishedSpans()).toHaveLength(0);
  expect(records).toHaveLength(1);
  expect(records[0]?.eventName).toBe(contract.name);
  expect(records[0]?.hrTime).toEqual([1, 0]);
  expect(records[0]?.spanContext?.traceId).toHaveLength(32);
  expect(records[0]?.attributes['event.id']).toBe(envelope.id);
  expect(records[0]?.attributes['event.synthetic']).toBe(false);
  await runtime.shutdown();
});

test('schema rejects missing, extra, sensitive and invalid attributes', () => {
  expect(validateEvent(contract, payload)).toBe(true);
  for (const invalid of [
    { ...payload, 'game.mode': 'unknown' },
    { ...payload, 'game.duration_ms': -1 },
    { ...payload, 'game.duration_ms': NaN },
    { ...payload, 'game.id': 'person@example.com' },
    { ...payload, 'auth.token': 'secret' },
    { 'game.id': 'game-1' },
  ])
    expect(validateEvent(contract, invalid)).toBe(false);
  expect(() =>
    defineEvent({ ...contract, attributes: { password: { type: 'string' } } })
  ).toThrow('Sensitive');
});

test('startup logs export without a span and arbitrary bodies and attributes are filtered', async () => {
  const exporter = new InMemoryLogRecordExporter();
  const runtime = createWorkerTelemetry({
    ...base,
    exporter: new InMemorySpanExporter(),
    logExporter: exporter,
  });
  recordStructuredLog({
    severity: 'error',
    loggerName: 'startup',
    message: 'Bearer credential person@example.com',
  });
  logs
    .getLogger('third-party')
    .emit({ body: { password: 'secret' }, attributes: { password: 'secret' } });
  logs.getLogger('third-party').emit({
    eventName: 'unknown.event.name',
    attributes: { password: 'secret' },
  });
  await runtime.forceFlush();
  const records = exporter.getFinishedLogRecords();
  expect(records).toHaveLength(2);
  expect(records[0]?.severityNumber).toBe(17);
  expect(records[0]?.attributes['app.log.message']).toBe(
    'Bearer [redacted] [email-redacted]'
  );
  expect(records[1]?.body).toBe('diagnostic');
  expect(records[1]?.attributes).toEqual({});
  await runtime.shutdown();
});

test('metrics reject unbounded dimensions and export accurate totals on invocation flush', async () => {
  const exporter = new InMemoryMetricExporter(
    AggregationTemporality.CUMULATIVE
  );
  const runtime = createWorkerTelemetry({
    ...base,
    exporter: new InMemorySpanExporter(),
    metricExporter: exporter,
  });
  const record = createMetric({
    name: 'example.games',
    description: 'Completed games',
    unit: '{game}',
    type: 'counter',
    dimensions: { 'game.mode': ['bot', 'multiplayer'] },
  });
  expect(record(1, { 'game.mode': 'bot' })).toBe(true);
  expect(record(1, { 'game.mode': 'bot' })).toBe(true);
  expect(record(1, { 'game.mode': 'bot', 'user.id': 'user-1' })).toBe(false);
  expect(record(1, { 'game.mode': 'game-1' })).toBe(false);
  expect(record(-1, { 'game.mode': 'bot' })).toBe(false);
  await runtime.forceFlush();
  const metric = exporter
    .getMetrics()
    .flatMap((r) => r.scopeMetrics.flatMap((s) => s.metrics))
    .find((m) => m.descriptor.name === 'example.games');
  expect(metric?.dataPoints[0]?.value).toBe(2);
  expect(metric?.dataPoints[0]?.attributes).toEqual({ 'game.mode': 'bot' });
  await runtime.shutdown();
});

test('Worker waitUntil reports exporter failure after foreground work completes', async () => {
  const runtime = createWorkerTelemetry({
    ...base,
    exporter: new InMemorySpanExporter(),
    metricExporter: {
      export(_data, callback) {
        callback({ code: 1 });
      },
      forceFlush: () => Promise.resolve(),
      shutdown: () => Promise.resolve(),
    },
  });
  createMetric({
    name: 'example.count',
    description: 'Count',
    unit: '1',
    type: 'counter',
    dimensions: {},
  })(1, {});
  let flush: Promise<unknown> | undefined;
  runtime.flushWith((promise) => {
    flush = promise;
  });
  await expect(flush).rejects.toThrow('Metric export failed');
  await runtime.shutdown();
});
