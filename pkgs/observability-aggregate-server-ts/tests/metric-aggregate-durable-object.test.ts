import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import {
  createMetricAggregateDurableObject,
  type MetricAggregateObjectStorage,
  metricAggregateHandoff,
  metricBackendSend,
} from '@pkgs/observability-aggregate-server-ts/metric-aggregate-durable-object';
import type { MetricBatch } from '@pkgs/observability-aggregate-server-ts/metric-increments';

type Env = { readonly metricsUrl?: string };

type OtlpRequest = {
  readonly resourceMetrics: readonly {
    readonly resource: {
      readonly attributes: readonly {
        readonly key: string;
        readonly value: { readonly stringValue?: string };
      }[];
    };
    readonly scopeMetrics: readonly {
      readonly metrics: readonly {
        readonly name: string;
        readonly sum?: {
          readonly aggregationTemporality: number;
          readonly dataPoints: readonly { readonly asDouble: number }[];
        };
      }[];
    }[];
  }[];
};

function objectStorage() {
  const stored = new Map<string, unknown>();
  let alarmAtMs: number | null = null;
  const storage: MetricAggregateObjectStorage = {
    list: async () => structuredClone(stored),
    put: async (entries) => {
      for (const [key, value] of Object.entries(entries))
        stored.set(key, structuredClone(value));
    },
    delete: async (keys) => keys.filter((key) => stored.delete(key)).length,
    getAlarm: async () => alarmAtMs,
    setAlarm: async (ms) => {
      alarmAtMs = ms;
    },
  };
  return {
    storage,
    alarmAtMs: () => alarmAtMs,
    alarmFired() {
      alarmAtMs = null;
    },
  };
}

/** A Worker whose isolates reach the aggregate through its binding. */
function worker(
  env: Env = { metricsUrl: 'https://metrics.example/v1/metrics' }
) {
  const { clock, timers } = createHarnessClock({ startMs: 1_000_000_000 });
  const received: { authorization: string | null; body: OtlpRequest }[] = [];
  const Aggregate = createMetricAggregateDurableObject<Env>({
    clock,
    settings: (bound) =>
      bound.metricsUrl === undefined
        ? null
        : {
            services: ['api'],
            attributeKeys: ['route'],
            seriesPerMetric: 8,
            identity: { instanceId: 'aggregate', environment: 'test' },
            send: metricBackendSend(
              {
                url: bound.metricsUrl,
                headers: { Authorization: 'Basic fixture' },
              },
              {
                fetch: async (_url, init) => {
                  received.push({
                    authorization: new Headers(init?.headers).get(
                      'authorization'
                    ),
                    body: (await new Response(
                      init?.body
                    ).json()) as OtlpRequest,
                  });
                  return Response.json({});
                },
              },
              timers
            ),
          },
  });
  const object = objectStorage();
  const names: string[] = [];
  const instance = new Aggregate({ storage: object.storage }, env);
  const handoff = metricAggregateHandoff(
    {
      idFromName: (name) => {
        names.push(name);
        return { name };
      },
      get: () => ({ fetch: (request) => instance.fetch(request) }),
    },
    timers
  );
  return { clock, object, instance, handoff, received, names };
}

function counted(
  by: number,
  overrides: Partial<MetricBatch> = {}
): MetricBatch {
  return {
    writer: 'isolate-1',
    sequence: 1,
    createdAtMs: 1_000_000_000,
    service: 'api',
    increments: [
      {
        scope: 'fixture',
        name: 'requests_total',
        unit: '',
        description: '',
        kind: 'sum',
        monotonic: true,
        bounds: [],
        attributes: { route: 'home' },
        value: by,
        count: 0,
        buckets: [],
      },
    ],
    ...overrides,
  };
}

test('isolates hand off to one named aggregate, which exports cumulative totals from its alarm under one identity', async () => {
  const { clock, object, instance, handoff, received, names } = worker();

  expect(await handoff(counted(3))).toEqual({ status: 'added', refused: 0 });
  expect(
    await handoff(counted(4, { writer: 'isolate-2', sequence: 1 }))
  ).toEqual({ status: 'added', refused: 0 });
  expect(await handoff(counted(3))).toEqual({ status: 'duplicate' });
  expect(new Set(names)).toEqual(new Set(['aggregate']));
  expect(object.alarmAtMs()).toBe(clock.now() + 60_000);

  for (let round = 0; round < 2; round += 1) {
    clock.advance(60_000);
    object.alarmFired();
    await instance.alarm();
  }

  expect(received.map((request) => request.authorization)).toEqual([
    'Basic fixture',
    'Basic fixture',
  ]);
  const last = received[1]!.body.resourceMetrics;
  expect(last).toHaveLength(1);
  expect(
    Object.fromEntries(
      last[0]!.resource.attributes.map((attribute) => [
        attribute.key,
        attribute.value.stringValue,
      ])
    )
  ).toEqual({
    'service.name': 'api',
    'service.instance.id': 'aggregate',
    'deployment.environment.name': 'test',
  });
  const metric = last[0]!.scopeMetrics[0]!.metrics[0]!;
  expect(metric.name).toBe('requests_total');
  // 2 is OTLP's cumulative temporality: the only one the backend accepts.
  expect(metric.sum?.aggregationTemporality).toBe(2);
  expect(metric.sum?.dataPoints.map((point) => point.asDouble)).toEqual([7]);
  // Nothing is left to state, so the aggregate sleeps until the next hand-off.
  expect(object.alarmAtMs()).toBeNull();
});

test('a hand-off from an unknown service or with an unknown label adds nothing', async () => {
  const { handoff, object } = worker();

  await expect(handoff(counted(1, { service: 'intruder' }))).rejects.toThrow(
    '400'
  );
  const labelled = counted(1);
  expect(
    await handoff({
      ...labelled,
      increments: [
        { ...labelled.increments[0]!, attributes: { 'user.id': 'u1' } },
      ],
    })
  ).toEqual({ status: 'added', refused: 1 });
  const totals = (await object.storage.list()).get('totals') as {
    waiting: Record<string, unknown>;
  };
  expect(Object.keys(totals.waiting)).toEqual([]);
});

test('where no metrics backend is configured the aggregate takes nothing, and the isolate keeps its counts', async () => {
  const { handoff } = worker({});

  await expect(handoff(counted(1))).rejects.toThrow('503');
});

test('an aggregate that does not answer is given up on at the deadline, so the flush ends', async () => {
  const { clock, timers } = createHarnessClock();
  const handoff = metricAggregateHandoff(
    {
      idFromName: (name) => ({ name }),
      get: () => ({ fetch: () => new Promise<Response>(() => undefined) }),
    },
    timers
  );

  const outcome = handoff(counted(1));
  clock.advance(10_000);

  await expect(outcome).rejects.toThrow('did not answer');
});
