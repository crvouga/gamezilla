import { expect, test } from 'bun:test';
import { JsonTraceSerializer } from '@opentelemetry/otlp-transformer';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { HttpResponseScope } from '@pkgs/http-client-shared-ts/response-scope';
import { HttpOtlpExporter } from '@pkgs/observability-runtime-shared-ts/http-otlp-exporter';
import { workerExporterOptions } from '@pkgs/observability-runtime-shared-ts/worker-exporters';

const base = {
  serviceName: 'fixture',
  serviceVersion: '1',
  buildSha: 'fixture',
  environment: 'test' as const,
  otlpUrl: 'https://collector.example/v1/traces',
  logsUrl: 'https://collector.example/v1/logs',
  metricsUrl: 'https://collector.example/v1/metrics',
};

test('all Worker signal exports release seven concurrent HTTP 200 acknowledgements', async () => {
  // regression: worker-http-response-body-leak
  const { clock, timers } = createHarnessClock();
  const payloads: unknown[] = [];
  const scope = new HttpResponseScope({
    fetch: async (_input, init) => {
      payloads.push(await new Response(init?.body).json());
      expect(new Headers(init?.headers).get('authorization')).toBe(
        'Bearer fixture-token'
      );
      return Response.json({});
    },
  });
  const configured = workerExporterOptions({
    ...base,
    http: scope,
    timers,
    otlpHeaders: { Authorization: 'Bearer fixture-token' },
  });
  const operations = Array.from(
    { length: 7 },
    (_, index) =>
      new Promise<void>((resolve, reject) => {
        const callback = (outcome: { code: number }) =>
          outcome.code === 0 ? resolve() : reject(new Error('export failed'));
        if (index % 3 === 0) configured.exporter!.export([], callback);
        if (index % 3 === 1) configured.logExporter!.export([], callback);
        if (index % 3 === 2)
          configured.metricExporter!.export(
            { resource: resourceFromAttributes({}), scopeMetrics: [] },
            callback
          );
      })
  );
  await Promise.all(operations);
  await Promise.all([
    configured.exporter!.forceFlush?.(),
    configured.logExporter!.forceFlush?.(),
    configured.metricExporter!.forceFlush(),
  ]);
  await scope.finish();
  expect(payloads).toHaveLength(7);
  expect(
    payloads.some((body) => JSON.stringify(body).includes('resourceSpans'))
  ).toBe(true);
  expect(
    payloads.some((body) => JSON.stringify(body).includes('resourceLogs'))
  ).toBe(true);
  expect(
    payloads.some((body) => JSON.stringify(body).includes('resourceMetrics'))
  ).toBe(true);
  expect(clock.pendingOneShotCount()).toBe(0);
});

function traceExporter(response: () => Promise<Response>) {
  const { clock, timers } = createHarnessClock();
  const scope = new HttpResponseScope({ fetch: response });
  const exporter = new HttpOtlpExporter(
    {
      url: base.otlpUrl,
      headers: {},
      serializer: JsonTraceSerializer,
      rejected: (outcome) => Number(outcome.partialSuccess?.rejectedSpans ?? 0),
    },
    scope,
    timers
  );
  return { clock, scope, exporter };
}

test.each([400, 429, 500, 503])(
  'HTTP %i export rejects loudly and cancels its body',
  async (status) => {
    let canceled = false;
    const { scope, exporter } = traceExporter(
      async () =>
        new Response(
          new ReadableStream({
            cancel() {
              canceled = true;
            },
          }),
          { status }
        )
    );
    const result = await new Promise<{ code: number }>((resolve) =>
      exporter.export([], resolve)
    );
    expect(result.code).toBe(1);
    await expect(exporter.forceFlush()).rejects.toThrow(
      `OTLP export rejected (${status})`
    );
    expect(canceled).toBe(true);
    await scope.finish();
  }
);

test('a collector partial rejection fails flush despite HTTP 200', async () => {
  const { scope, exporter } = traceExporter(async () =>
    Response.json({ partialSuccess: { rejectedSpans: '1' } })
  );
  const result = await new Promise<{ code: number }>((resolve) =>
    exporter.export([], resolve)
  );
  expect(result.code).toBe(1);
  await expect(exporter.forceFlush()).rejects.toThrow('OTLP records rejected');
  await scope.finish();
});

test('oversized acknowledgements cancel instead of buffering without bound', async () => {
  let canceled = false;
  const { scope, exporter } = traceExporter(
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(65_537));
          },
          cancel() {
            canceled = true;
          },
        })
      )
  );
  const result = await new Promise<{ code: number }>((resolve) =>
    exporter.export([], resolve)
  );
  expect(result.code).toBe(1);
  await expect(exporter.forceFlush()).rejects.toThrow(
    'OTLP acknowledgement too large'
  );
  expect(canceled).toBe(true);
  await scope.finish();
});

test('a stalled acknowledgement times out and cancels on virtual time', async () => {
  let canceled = false;
  let started!: () => void;
  const reading = new Promise<void>((resolve) => {
    started = resolve;
  });
  const { clock, scope, exporter } = traceExporter(
    async () =>
      new Response(
        new ReadableStream({
          pull() {
            started();
          },
          cancel() {
            canceled = true;
          },
        })
      )
  );
  const result = new Promise<{ code: number }>((resolve) =>
    exporter.export([], resolve)
  );
  await reading;
  clock.advance(5000);
  expect((await result).code).toBe(1);
  await expect(exporter.forceFlush()).rejects.toThrow(
    'OTLP acknowledgement timed out'
  );
  await scope.finish();
  expect(canceled).toBe(true);
});

test('Worker export never falls back to implicit SDK I/O', () => {
  expect(() => workerExporterOptions(base)).toThrow(
    'Worker telemetry requires injected HTTP and timers'
  );
});

test.each([
  'not-json',
  'null',
  '[]',
  '{"partialSuccess":{"rejectedSpans":"invalid"}}',
])('invalid acknowledgement %s fails export', async (body) => {
  const { scope, exporter } = traceExporter(async () => new Response(body));
  const result = await new Promise<{ code: number }>((resolve) =>
    exporter.export([], resolve)
  );
  expect(result.code).toBe(1);
  await expect(exporter.forceFlush()).rejects.toThrow();
  await scope.finish();
});

// regression: otlp-timeout-unfinished-http-request
test('a timeout waits for transport cancellation before the invocation ends', async () => {
  const aborted = Promise.withResolvers<void>();
  const canceled = Promise.withResolvers<void>();
  const { clock, scope, exporter } = traceExporter(async () => {
    await aborted.promise;
    await canceled.promise;
    throw new Error('transport aborted');
  });
  let callbackRan = false;
  const outcome = new Promise<{ code: number }>((resolve) => {
    exporter.export([], (result) => {
      callbackRan = true;
      resolve(result);
    });
  });
  clock.advance(5000);
  aborted.resolve();
  // Drain the deadline reaction while the transport is still canceling.
  for (let turn = 0; turn < 20; turn++) await Promise.resolve();
  const prematureCallback = callbackRan;
  canceled.resolve();
  expect((await outcome).code).toBe(1);
  expect(prematureCallback).toBe(false);
  await expect(exporter.forceFlush()).rejects.toThrow(
    'OTLP acknowledgement timed out'
  );
  await scope.finish();
});
