import { afterEach, expect, test } from 'bun:test';
import { context, metrics, propagation, trace } from '@opentelemetry/api';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
} from '@opentelemetry/sdk-metrics';
import {
  AlwaysOffSampler,
  InMemorySpanExporter,
} from '@opentelemetry/sdk-trace-base';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import { createWorkerTelemetry } from '@pkgs/observability-root-server/worker-worker';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared/impl-mockingbird-sqlite';
import { createSyncApp } from '@pkgs/sync-engine-server/create-sync-app';
import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
import { mutationRegistry } from '@pkgs/sync-engine-shared/mutations-registry';
import { MutationError } from '@pkgs/sync-engine-shared/mutations-types';
import { syncEngineServerSchema } from '@pkgs/sync-engine-shared/tables';
import {
  SYNC_PROTOCOL_HEADER,
  SYNC_PROTOCOL_VERSION,
} from '@pkgs/sync-engine-shared/v2';
import { z } from 'zod';

afterEach(() => {
  metrics.disable();
  trace.disable();
  propagation.disable();
  context.disable();
});

const AT = '2026-09-01T12:00:00.000Z';

function upload(id: string, name: string) {
  return {
    mutations: [
      {
        id,
        name,
        args: '{}',
        clientId: 'alice-phone',
        seq: Number(id.replace(/\D/g, '')),
        createdAt: AT,
        originTraceparent: null,
      },
    ],
  };
}

// regression: mutation-replay-outcome-uncounted
// Literal input: one mutation of each kind of ending: saved, repeated after
// its verdict, turned down by the rules, and failed by the database.
test('every replay is counted by what became of it, and a failure is the server own', async () => {
  const exporter = new InMemoryMetricExporter(
    AggregationTemporality.CUMULATIVE
  );
  const runtime = createWorkerTelemetry({
    serviceName: 'replay-test',
    serviceVersion: '1',
    environment: 'test',
    buildSha: 'abc',
    exporter: new InMemorySpanExporter(),
    sampler: new AlwaysOffSampler(),
    metricExporter: exporter,
  });
  const db = SqlClientImplMockingbirdSqlite.open();
  await db.connect();
  try {
    await reconcileSqliteSchema(db, syncEngineServerSchema, {
      ownership: 'declared-only',
    });
    let ids = 0;
    const save = defineMutation({
      name: 'save',
      args: z.object({}),
      async run() {},
    });
    const deny = defineMutation({
      name: 'deny',
      args: z.object({}),
      async run() {
        throw new MutationError('not_granted', 'Not allowed.');
      },
    });
    const crash = defineMutation({
      name: 'crash',
      args: z.object({}),
      async run() {
        throw new Error('could not serialize access due to concurrent update');
      },
    });
    const app = createSyncApp({
      resolveAuth: async () => ({
        actorId: 'alice',
        deviceId: 'alice-phone',
        accountId: 'alice',
        isAnon: false,
      }),
      getSql: () => db,
      queries: {},
      mutations: mutationRegistry([save, deny, crash]),
      now: () => 1_790_000_000_000,
      createId: () => `id-${++ids}`,
    });
    const post = (body: unknown) =>
      app.request('http://example.test/mutations', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [SYNC_PROTOCOL_HEADER]: String(SYNC_PROTOCOL_VERSION),
        },
        body: JSON.stringify(body),
      });
    await post(upload('m1', 'save'));
    await post(upload('m1', 'save'));
    await post(upload('m2', 'deny'));
    await Promise.resolve(post(upload('m3', 'crash'))).catch(() => undefined);
    await runtime.forceFlush();
    const counted = exporter
      .getMetrics()
      .flatMap((r) => r.scopeMetrics.flatMap((s) => s.metrics))
      .find((m) => m.descriptor.name === 'sync.mutation.replays');
    const byOutcome = Object.fromEntries(
      (counted?.dataPoints ?? []).map((p) => [
        String(p.attributes['app.mutation.outcome']),
        p.value,
      ])
    );
    expect(byOutcome).toEqual({
      applied: 1,
      duplicate: 1,
      rejected: 1,
      failed: 1,
    });
  } finally {
    await db.disconnect();
    await runtime.shutdown();
  }
});
