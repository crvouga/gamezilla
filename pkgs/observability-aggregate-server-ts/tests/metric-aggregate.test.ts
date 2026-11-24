import { expect, test } from 'bun:test';
import { JsonMetricsSerializer } from '@opentelemetry/otlp-transformer';
import {
  AggregationType,
  DataPointType,
  InstrumentType,
  MeterProvider,
  type ResourceMetrics,
} from '@opentelemetry/sdk-metrics';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import {
  type MetricAggregateConfig,
  MetricAggregateStore,
} from '@pkgs/observability-aggregate-server-ts/metric-aggregate-store';
import { MetricHandoffExporter } from '@pkgs/observability-aggregate-server-ts/metric-handoff-exporter';
import {
  type MetricBatch,
  parseMetricBatch,
} from '@pkgs/observability-aggregate-server-ts/metric-increments';
import { FlushMetricReader } from '@pkgs/observability-runtime-shared-ts/flush-metric-reader';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const MINUTE = 60_000;
const CONFIG: MetricAggregateConfig = {
  identity: { instanceId: 'aggregate', environment: 'test' },
  exportEveryMs: MINUTE,
  rememberWriterMs: 60 * MINUTE,
  writers: 100,
  limits: {
    seriesPerMetric: 2,
    series: 50,
    restartAfterMs: 2.5 * MINUTE,
    forgetAfterMs: 24 * 60 * MINUTE,
  },
};

type Stated = {
  readonly service: unknown;
  readonly instance: unknown;
  readonly name: string;
  readonly route: unknown;
  readonly startSeconds: number;
  readonly atSeconds: number;
  readonly value: unknown;
};

function statedBy(payloads: readonly ResourceMetrics[]): Stated[] {
  return payloads.flatMap((payload) =>
    payload.scopeMetrics.flatMap((scope) =>
      scope.metrics.flatMap((metric) => {
        const values =
          metric.dataPointType === DataPointType.HISTOGRAM
            ? metric.dataPoints.map((point) => ({
                counts: point.value.buckets.counts,
                count: point.value.count,
              }))
            : metric.dataPoints.map((point) => point.value);
        return metric.dataPoints.map((point, index) => ({
          service: payload.resource.attributes['service.name'],
          instance: payload.resource.attributes['service.instance.id'],
          name: metric.descriptor.name,
          route: point.attributes['route'],
          startSeconds: point.startTime[0],
          atSeconds: point.endTime[0],
          value: values[index],
        }));
      })
    )
  );
}

/** One deployment: its aggregate, the backend it tells, and its isolates. */
function deployment(config: MetricAggregateConfig = CONFIG) {
  const { clock } = createHarnessClock({ startMs: 1_000_000_000 });
  const stored = new Map<string, unknown>();
  const backend = { up: true, payloads: [] as ResourceMetrics[] };
  const link = {
    up: true,
    loseNextAnswer: false,
    held: null as { reached: () => void; released: Promise<void> } | null,
  };
  const lost: number[] = [];
  let wakeAtMs: number | null = null;
  const open = () =>
    new MetricAggregateStore(
      {
        clock,
        storage: {
          read: async () => structuredClone(stored),
          write: async ({ put, remove }) => {
            for (const [key, value] of Object.entries(put))
              stored.set(key, structuredClone(value));
            for (const key of remove) stored.delete(key);
          },
          wakeAt: async (atMs) => {
            wakeAtMs ??= atMs;
          },
        },
        send: async (payload) => {
          if (!backend.up) throw new Error('backend refused');
          backend.payloads.push(payload);
        },
      },
      config
    );
  let aggregate = open();
  const handoff = async (sent: MetricBatch) => {
    if (!link.up) throw new Error('aggregate unreachable');
    const parsed = parseMetricBatch(JSON.parse(JSON.stringify(sent)), {
      services: ['api'],
      attributeKeys: ['route'],
      maxIncrements: 100,
    });
    if (parsed === null) throw new Error('hand-off refused');
    const outcome = await aggregate.add(parsed.batch);
    if (outcome.status === 'busy') throw new Error('aggregate busy');
    const held = link.held;
    if (held !== null) {
      link.held = null;
      held.reached();
      await held.released;
    }
    if (link.loseNextAnswer) {
      link.loseNextAnswer = false;
      throw new Error('answer lost');
    }
    return outcome;
  };
  return {
    clock,
    backend,
    link,
    lost,
    wakeAtMs: () => wakeAtMs,
    /** The aggregate adds the next hand-off, but its answer waits. */
    holdNextAnswer() {
      const reached = Promise.withResolvers<void>();
      const released = Promise.withResolvers<void>();
      link.held = { reached: reached.resolve, released: released.promise };
      return { reached: reached.promise, release: released.resolve };
    },
    restartAggregate() {
      aggregate = open();
    },
    isolate(writer: string) {
      const exporter = new MetricHandoffExporter({
        writer,
        service: 'api',
        clock,
        handoff,
        onLost: (given) => lost.push(given.increments),
      });
      const provider = new MeterProvider({
        readers: [new FlushMetricReader(exporter)],
        views: [
          {
            instrumentType: InstrumentType.HISTOGRAM,
            aggregation: {
              type: AggregationType.EXPLICIT_BUCKET_HISTOGRAM,
              options: { boundaries: [1, 5] },
            },
          },
        ],
      });
      const meter = provider.getMeter('fixture');
      return {
        exporter,
        requests: meter.createCounter('requests_total'),
        duration: meter.createHistogram('request_duration_seconds'),
        age: meter.createGauge('backlog_age_seconds'),
        flush: () => provider.forceFlush(),
      };
    },
    /** A minute passes and the aggregate's alarm fires. */
    async exported(afterMs = MINUTE) {
      clock.advance(afterMs);
      wakeAtMs = null;
      const from = backend.payloads.length;
      const acknowledged = await aggregate.exportTotals();
      return { acknowledged, stated: statedBy(backend.payloads.slice(from)) };
    },
  };
}

// regression: metric-series-multiply-by-worker-isolate
test('two isolates counting the same metric are stored as one series whose total is their sum, under one writer identity', async () => {
  const world = deployment();
  const first = world.isolate('isolate-1');
  const second = world.isolate('isolate-2');
  first.requests.add(3, { route: 'home' });
  second.requests.add(4, { route: 'home' });
  await first.flush();
  await second.flush();

  await world.exported();
  const { stated } = await world.exported();

  expect(stated.map((point) => [point.name, point.route, point.value])).toEqual(
    [['requests_total', 'home', 7]]
  );
  const identities = world.backend.payloads.map((payload) => {
    const request = JSON.parse(
      new TextDecoder().decode(JsonMetricsSerializer.serializeRequest(payload))
    ) as {
      resourceMetrics: {
        resource: { attributes: { key: string; value: unknown }[] };
      }[];
    };
    return request.resourceMetrics.map((resource) =>
      resource.resource.attributes
        .filter((attribute) => attribute.key === 'service.instance.id')
        .map((attribute) => attribute.value)
    );
  });
  expect(identities).toEqual([
    [[{ stringValue: 'aggregate' }]],
    [[{ stringValue: 'aggregate' }]],
  ]);
});

test('a series begins with an explicit zero, so its first count is growth a backend can see', async () => {
  const world = deployment();
  const isolate = world.isolate('isolate-1');
  isolate.requests.add(5, { route: 'home' });
  await isolate.flush();

  const first = await world.exported();
  const second = await world.exported();

  expect(first.stated.map((point) => point.value)).toEqual([0]);
  expect(second.stated.map((point) => point.value)).toEqual([5]);
  expect(second.stated[0]?.startSeconds).toBe(first.stated[0]?.startSeconds);
});

test('a counter never goes backwards when the isolate that counted is replaced', async () => {
  const world = deployment();
  const values: unknown[] = [];
  const starts = new Set<number>();
  const record = async () => {
    for (const point of (await world.exported()).stated) {
      values.push(point.value);
      starts.add(point.startSeconds);
    }
  };
  const first = world.isolate('isolate-1');
  first.requests.add(5, { route: 'home' });
  await first.flush();
  await record();
  await record();
  // The first isolate is gone; its replacement starts counting from nothing.
  const second = world.isolate('isolate-2');
  second.requests.add(2, { route: 'home' });
  await second.flush();
  await record();
  await record();

  expect(values).toEqual([0, 5, 7, 7]);
  expect(starts.size).toBe(1);
});

test('histogram buckets from several isolates add up per bucket', async () => {
  const world = deployment();
  const first = world.isolate('isolate-1');
  const second = world.isolate('isolate-2');
  for (const seconds of [0.5, 3]) first.duration.record(seconds);
  for (const seconds of [0.75, 9]) second.duration.record(seconds);
  await first.flush();
  await second.flush();

  const announced = await world.exported();
  const { stated } = await world.exported();

  expect(announced.stated.map((point) => point.value)).toEqual([
    { counts: [0, 0, 0], count: 0 },
  ]);
  expect(stated.map((point) => point.value)).toEqual([
    { counts: [2, 1, 1], count: 4 },
  ]);
});

test('a hand-off whose answer was lost is added once when it is delivered again', async () => {
  const world = deployment();
  const isolate = world.isolate('isolate-1');
  isolate.requests.add(5, { route: 'home' });
  world.link.loseNextAnswer = true;
  await expect(isolate.flush()).rejects.toThrow();
  expect(isolate.exporter.undelivered).toBe(1);
  isolate.requests.add(1, { route: 'home' });
  await isolate.flush();
  expect(isolate.exporter.undelivered).toBe(0);

  await world.exported();
  const { stated } = await world.exported();

  expect(stated.map((point) => point.value)).toEqual([6]);
});

test('an isolate keeps what it counted while the aggregate is unreachable and delivers it later', async () => {
  const world = deployment();
  const isolate = world.isolate('isolate-1');
  world.link.up = false;
  isolate.requests.add(2, { route: 'home' });
  await expect(isolate.flush()).rejects.toThrow();
  isolate.requests.add(3, { route: 'home' });
  await expect(isolate.flush()).rejects.toThrow();
  expect(isolate.exporter.undelivered).toBe(2);
  world.link.up = true;
  await isolate.flush();

  await world.exported();
  const { stated } = await world.exported();

  expect(stated.map((point) => point.value)).toEqual([5]);
  expect(world.lost).toEqual([]);
});

test('a flush never waits for a hand-off another invocation is delivering, and what it counted is taken along', async () => {
  const world = deployment();
  const isolate = world.isolate('isolate-1');
  const answer = world.holdNextAnswer();
  isolate.requests.add(2, { route: 'home' });
  const first = isolate.flush();
  await answer.reached;
  isolate.requests.add(3, { route: 'home' });

  // The second invocation's flush ends while the first is still unanswered.
  await isolate.flush();
  expect(isolate.exporter.undelivered).toBe(2);
  answer.release();
  await first;
  expect(isolate.exporter.undelivered).toBe(0);

  await world.exported();
  expect((await world.exported()).stated.map((point) => point.value)).toEqual([
    5,
  ]);
});

test('a flush whose invocation ended mid hand-off is taken over, and its hand-off is still added once', async () => {
  const world = deployment();
  const isolate = world.isolate('isolate-1');
  const answer = world.holdNextAnswer();
  isolate.requests.add(2, { route: 'home' });
  // This flush is never answered: its invocation was torn down.
  void isolate.flush().catch(() => undefined);
  await answer.reached;
  isolate.requests.add(3, { route: 'home' });
  world.clock.advance(16_000);

  await isolate.flush();

  expect(isolate.exporter.undelivered).toBe(0);
  await world.exported();
  expect((await world.exported()).stated.map((point) => point.value)).toEqual([
    5,
  ]);
});

test('an export the backend refuses loses nothing and is stated again', async () => {
  const world = deployment();
  const isolate = world.isolate('isolate-1');
  isolate.requests.add(4, { route: 'home' });
  await isolate.flush();
  await world.exported();
  world.backend.up = false;
  const refused = await world.exported();
  expect(refused.acknowledged).toBe(false);
  expect(world.wakeAtMs()).toBe(world.clock.now() + MINUTE);
  isolate.requests.add(1, { route: 'home' });
  await isolate.flush();
  world.backend.up = true;

  const { stated } = await world.exported();

  expect(stated.map((point) => point.value)).toEqual([5]);
});

test('after a gap in exports every total begins again from zero and nothing counted meanwhile is lost', async () => {
  const world = deployment();
  const isolate = world.isolate('isolate-1');
  isolate.requests.add(5, { route: 'home' });
  await isolate.flush();
  const before = [await world.exported(), await world.exported()];
  isolate.requests.add(2, { route: 'home' });
  await isolate.flush();

  const resumed = await world.exported(10 * MINUTE);
  const after = await world.exported();

  expect(before.map((round) => round.stated[0]?.value)).toEqual([0, 5]);
  expect(resumed.stated.map((point) => point.value)).toEqual([0]);
  expect(after.stated.map((point) => point.value)).toEqual([2]);
  expect(resumed.stated[0]?.startSeconds).toBeGreaterThan(
    before[1]?.stated[0]?.startSeconds ?? Number.POSITIVE_INFINITY
  );
});

test('the totals and the hand-offs already added survive the aggregate restarting', async () => {
  const world = deployment();
  const isolate = world.isolate('isolate-1');
  isolate.requests.add(5, { route: 'home' });
  world.link.loseNextAnswer = true;
  await expect(isolate.flush()).rejects.toThrow();
  await world.exported();
  await world.exported();
  world.restartAggregate();
  // Delivered again to the restarted aggregate: recognized, not added twice.
  isolate.requests.add(1, { route: 'home' });
  await isolate.flush();

  const { stated } = await world.exported();

  expect(stated.map((point) => point.value)).toEqual([6]);
});

test('a metric holds no more label combinations than its budget, and says what it left out', async () => {
  const world = deployment();
  const isolate = world.isolate('isolate-1');
  for (const route of ['home', 'play', 'settings'])
    isolate.requests.add(1, { route });
  await isolate.flush();

  await world.exported();
  const { stated } = await world.exported();

  expect(stated.map((point) => point.route)).toEqual(['home', 'play']);
  expect(world.lost).toEqual([1]);
});

test('a gauge is stated once per reading, at the time it was read', async () => {
  const world = deployment();
  const isolate = world.isolate('isolate-1');
  isolate.age.record(30);
  await isolate.flush();
  const readAtSeconds = Math.floor(world.clock.now() / 1000);

  const first = await world.exported();
  const second = await world.exported();

  expect(first.stated.map((point) => [point.value, point.atSeconds])).toEqual([
    [30, readAtSeconds],
  ]);
  expect(second.stated).toEqual([]);
});

test('a hand-off older than the aggregate remembers writers for is given up, never added twice', async () => {
  const world = deployment();
  const isolate = world.isolate('isolate-1');
  isolate.requests.add(5, { route: 'home' });
  world.link.up = false;
  await expect(isolate.flush()).rejects.toThrow();
  world.clock.advance(31 * MINUTE);
  world.link.up = true;
  await isolate.flush();

  expect(world.lost).toEqual([1]);
  expect((await world.exported()).stated).toEqual([]);
});

type Step =
  | { readonly kind: 'count'; readonly isolate: number; readonly by: number }
  | {
      readonly kind: 'flush';
      readonly isolate: number;
      readonly link: 'up' | 'down' | 'answer-lost';
    }
  | { readonly kind: 'replace'; readonly isolate: number }
  | {
      readonly kind: 'export';
      readonly backendUp: boolean;
      readonly afterMinutes: number;
    }
  | { readonly kind: 'restart' };

const isolateIndex = fc.integer({ min: 0, max: 2 });
const step: fc.Arbitrary<Step> = fc.oneof(
  fc.record({
    kind: fc.constant('count' as const),
    isolate: isolateIndex,
    by: fc.integer({ min: 1, max: 5 }),
  }),
  fc.record({
    kind: fc.constant('flush' as const),
    isolate: isolateIndex,
    link: fc.constantFrom(
      'up' as const,
      'down' as const,
      'answer-lost' as const
    ),
  }),
  fc.record({ kind: fc.constant('replace' as const), isolate: isolateIndex }),
  fc.record({
    kind: fc.constant('export' as const),
    backendUp: fc.boolean(),
    afterMinutes: fc.constantFrom(1, 1, 3),
  }),
  fc.record({ kind: fc.constant('restart' as const) })
);

test('whatever fails and in whatever order, each run of totals only grows and the runs add up to exactly what was counted', async () => {
  await assertProperty(
    'aggregated totals equal what isolates counted',
    fc.asyncProperty(
      fc.array(step, { maxLength: 40 }).filter(
        // A hand-off stays deliverable for half an hour.
        (steps) => steps.filter((s) => s.kind === 'export').length <= 8
      ),
      async (steps) => {
        const world = deployment();
        const isolates = [0, 1, 2].map((index) =>
          world.isolate(`isolate-${index}-0`)
        );
        const stated: Stated[] = [];
        let counted = 0;
        let replaced = 0;
        const flush = async (
          index: number,
          link: 'up' | 'down' | 'answer-lost'
        ) => {
          world.link.up = link !== 'down';
          world.link.loseNextAnswer = link === 'answer-lost';
          await isolates[index]!.flush().catch(() => undefined);
          world.link.up = true;
          world.link.loseNextAnswer = false;
        };
        const exportNow = async (backendUp: boolean, afterMinutes: number) => {
          world.backend.up = backendUp;
          stated.push(...(await world.exported(afterMinutes * MINUTE)).stated);
        };
        for (const next of steps) {
          if (next.kind === 'count') {
            isolates[next.isolate]!.requests.add(next.by, { route: 'home' });
            counted += next.by;
          } else if (next.kind === 'flush') {
            await flush(next.isolate, next.link);
          } else if (next.kind === 'replace') {
            // An isolate that ends after a delivered flush loses nothing.
            await flush(next.isolate, 'up');
            replaced += 1;
            isolates[next.isolate] = world.isolate(
              `isolate-${next.isolate}-${replaced}`
            );
          } else if (next.kind === 'export') {
            await exportNow(next.backendUp, next.afterMinutes);
          } else {
            world.restartAggregate();
          }
        }
        for (const index of [0, 1, 2]) await flush(index, 'up');
        await exportNow(true, 1);
        await exportNow(true, 1);

        const runs = new Map<number, number[]>();
        for (const point of stated) {
          const run = runs.get(point.startSeconds) ?? [];
          run.push(point.value as number);
          runs.set(point.startSeconds, run);
        }
        let total = 0;
        for (const run of runs.values()) {
          expect(run).toEqual([...run].sort((a, b) => a - b));
          expect(run[0]).toBe(0);
          total += run[run.length - 1]!;
        }
        expect(total).toBe(counted);
        expect(world.lost).toEqual([]);
      }
    )
  );
});
