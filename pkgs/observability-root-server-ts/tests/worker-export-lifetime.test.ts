import { afterEach, expect, test } from 'bun:test';
import { context, metrics, propagation, trace } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { createWorkerTelemetry } from '@pkgs/observability-root-server-ts/worker-worker';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

afterEach(() => {
  trace.disable();
  context.disable();
  propagation.disable();
  metrics.disable();
  logs.disable();
});

// regression: worker-telemetry-exports-before-response
test('ending seven SQL spans does not open collector connections on the foreground path', async () => {
  const { timers } = createHarnessClock();
  const requests: string[] = [];
  const runtime = createWorkerTelemetry({
    serviceName: 'fixture',
    serviceVersion: '1',
    environment: 'test',
    buildSha: 'fixture',
    registerGlobal: false,
    http: {
      fetch: async (input) => {
        requests.push(String(input));
        return Response.json({});
      },
    },
    timers,
    otlpUrl: 'https://collector.example/v1/traces',
  });
  try {
    for (let i = 0; i < 7; i++)
      runtime.provider.getTracer('fixture').startSpan('sql.query').end();
    expect(requests).toEqual([]);
    const background: Promise<unknown>[] = [];
    runtime.flushWith((work) => background.push(work));
    await Promise.all(background);
    expect(requests).toEqual(['https://collector.example/v1/traces']);
  } finally {
    await runtime.shutdown();
  }
});

// regression: worker-log-export-without-wait-until
test('a full log batch stays in memory until the invocation schedules its flush', async () => {
  const { timers } = createHarnessClock();
  const requests: string[] = [];
  const runtime = createWorkerTelemetry({
    serviceName: 'fixture',
    serviceVersion: '1',
    environment: 'test',
    buildSha: 'fixture',
    http: {
      fetch: async (input) => {
        requests.push(String(input));
        return Response.json({});
      },
    },
    timers,
    otlpUrl: 'https://collector.example/v1/traces',
    logsUrl: 'https://collector.example/v1/logs',
  });
  try {
    for (let i = 0; i < 257; i++)
      logs.getLogger('fixture').emit({ body: 'diagnostic' });
    await Promise.resolve();
    expect(requests).toEqual([]);
    await runtime.forceFlush();
    expect(requests).toEqual(['https://collector.example/v1/logs']);
  } finally {
    await runtime.shutdown();
  }
});

test('each burst is preserved as one acknowledged batch without foreground exports', async () => {
  await assertProperty(
    'Worker span export ownership',
    fc.asyncProperty(fc.integer({ min: 1, max: 64 }), async (count) => {
      const { timers } = createHarnessClock();
      const bodies: string[] = [];
      const runtime = createWorkerTelemetry({
        serviceName: 'fixture',
        serviceVersion: '1',
        environment: 'test',
        buildSha: 'fixture',
        registerGlobal: false,
        http: {
          fetch: async (_input, init) => {
            bodies.push(new TextDecoder().decode(init?.body as ArrayBuffer));
            return Response.json({});
          },
        },
        timers,
        otlpUrl: 'https://collector.example/v1/traces',
      });
      try {
        for (let i = 0; i < count; i++)
          runtime.provider.getTracer('fixture').startSpan(`span-${i}`).end();
        expect(bodies).toHaveLength(0);
        await runtime.forceFlush();
        expect(bodies).toHaveLength(1);
        const payload = JSON.parse(bodies[0]!) as {
          resourceSpans: { scopeSpans: { spans: unknown[] }[] }[];
        };
        expect(
          payload.resourceSpans.flatMap((resource) =>
            resource.scopeSpans.flatMap((scope) => scope.spans)
          )
        ).toHaveLength(count);
      } finally {
        await runtime.shutdown();
      }
    })
  );
});

test('a later invocation flush does not wait for an earlier invocation HTTP response', async () => {
  const { timers } = createHarnessClock();
  const firstResponse = Promise.withResolvers<Response>();
  let calls = 0;
  const runtime = createWorkerTelemetry({
    serviceName: 'fixture',
    serviceVersion: '1',
    environment: 'test',
    buildSha: 'fixture',
    registerGlobal: false,
    http: {
      fetch: async () =>
        ++calls === 1 ? firstResponse.promise : Response.json({}),
    },
    timers,
    otlpUrl: 'https://collector.example/v1/traces',
  });
  let firstDone = false;
  let secondDone = false;
  runtime.provider.getTracer('fixture').startSpan('first').end();
  const first = runtime.forceFlush().then(() => {
    firstDone = true;
  });
  runtime.provider.getTracer('fixture').startSpan('second').end();
  const second = runtime.forceFlush().then(() => {
    secondDone = true;
  });
  try {
    for (let turn = 0; turn < 64; turn++) await Promise.resolve();
    expect(secondDone).toBe(true);
    expect(firstDone).toBe(false);
  } finally {
    firstResponse.resolve(Response.json({}));
    await Promise.all([first, second]);
    await runtime.shutdown();
  }
});

// regression: worker-metric-flush-joins-foreign-io
test('an acknowledged metric batch does not join exporter I/O owned by another invocation', async () => {
  const foreign = Promise.withResolvers<void>();
  let foreignFlushes = 0;
  const runtime = createWorkerTelemetry({
    serviceName: 'fixture',
    serviceVersion: '1',
    environment: 'test',
    buildSha: 'fixture',
    registerGlobal: false,
    exporter: {
      export: (_spans, done) => done({ code: 0 }),
      forceFlush: async () => {},
      shutdown: async () => {},
    },
    metricExporter: {
      export: (_metrics, done) => done({ code: 0 }),
      forceFlush: () => {
        foreignFlushes++;
        return foreign.promise;
      },
      shutdown: async () => {},
    },
  });
  let settled = false;
  const flush = runtime.forceFlush().then(() => {
    settled = true;
  });
  try {
    for (let turn = 0; turn < 64; turn++) await Promise.resolve();
    expect(settled).toBe(true);
    expect(foreignFlushes).toBe(0);
  } finally {
    foreign.resolve();
    await flush;
    await runtime.shutdown();
  }
});
