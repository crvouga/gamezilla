import { afterEach, expect, test } from 'bun:test';
import { drainAndNotifyOutbox } from '@libs/app-root-server/outbox-drain';
import { observeScheduledOutboxDrain } from '@libs/app-root-server/outbox-health';
import { context, metrics, propagation, trace } from '@opentelemetry/api';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
} from '@opentelemetry/sdk-metrics';
import { InMemorySpanExporter } from '@opentelemetry/sdk-trace-base';
import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared/message';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared/impl-in-memory';
import { createWorkerTelemetry } from '@pkgs/observability-root-server/worker-worker';
import { OutboxConsumerRegistry } from '@pkgs/outbox-shared/define-consumer';
import { Outbox } from '@pkgs/outbox-shared/outbox';
import { reconcileOutbox } from '@pkgs/outbox-shared/reconcile';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server/impl-bun-sqlite';

afterEach(() => {
  metrics.disable();
  trace.disable();
  propagation.disable();
  context.disable();
});

function telemetry() {
  const exporter = new InMemoryMetricExporter(
    AggregationTemporality.CUMULATIVE
  );
  const runtime = createWorkerTelemetry({
    serviceName: 'outbox-health-test',
    serviceVersion: '1',
    environment: 'staging',
    buildSha: 'abc',
    exporter: new InMemorySpanExporter(),
    metricExporter: exporter,
  });
  const points = async (name: string) => {
    await runtime.forceFlush();
    return (
      exporter
        .getMetrics()
        .flatMap((r) => r.scopeMetrics.flatMap((s) => s.metrics))
        .find((m) => m.descriptor.name === name)
        ?.dataPoints.map(
          (p): Record<string, unknown> => ({ value: p.value, ...p.attributes })
        ) ?? []
    );
  };
  return { runtime, points };
}

const Ping = createMessageNamespace('outbox', 'health')(
  'ping',
  (value): value is { n: number } =>
    isPlainRecord(value) && typeof value['n'] === 'number'
);

// regression: outbox-exhaustion-invisible
test('a delivery parked after its last attempt is counted for the environment', async () => {
  const { runtime, points } = telemetry();
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  await reconcileOutbox(db);
  const now = Date.parse('2026-10-01T00:00:00.000Z');
  const clock = { now: () => now };
  const createId = () => 'event-1';
  const consumerRegistry = new OutboxConsumerRegistry();
  consumerRegistry.register({
    id: 'always-fails',
    on: Ping,
    retryPolicy: { maxAttempts: 1, backoffMs: [1_000] },
    handler: async () => {
      throw new Error('provider down');
    },
  });
  await new Outbox({
    tx: db,
    env: { now: () => new Date(now), createId },
  }).send({ id: 'event-1', message: Ping({ n: 1 }) });

  await drainAndNotifyOutbox({
    db,
    clock,
    createId,
    consumerRegistry,
    objectStore: new ObjectStoreImplInMemory(),
    pubsub: null,
  });

  expect(await points('outbox.deliveries.exhausted')).toEqual([
    { value: 1, 'deployment.environment.name': 'staging' },
  ]);
  await db.disconnect();
  await runtime.shutdown();
});

// regression: drain-failure-masked-by-heartbeat
test('a scheduled drain that fails is counted as a failure, apart from the heartbeat', async () => {
  const { runtime, points } = telemetry();
  await expect(
    observeScheduledOutboxDrain(() =>
      Promise.reject(new Error('database unavailable'))
    )
  ).rejects.toThrow('database unavailable');
  expect(await observeScheduledOutboxDrain(async () => 3)).toBe(3);

  expect(await points('outbox.drain.runs')).toEqual([
    {
      value: 1,
      'app.outcome': 'failure',
      'deployment.environment.name': 'staging',
    },
    {
      value: 1,
      'app.outcome': 'success',
      'deployment.environment.name': 'staging',
    },
  ]);
  await runtime.shutdown();
});
