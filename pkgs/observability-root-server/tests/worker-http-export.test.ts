import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { HttpResponseScope } from '@pkgs/http-client-shared/response-scope';
import { createWorkerTelemetry } from '@pkgs/observability-root-server/worker-worker';

test('Worker telemetry drains seven spans in one acknowledged HTTP batch', async () => {
  // regression: worker-http-response-body-leak
  const { clock, timers } = createHarnessClock();
  let calls = 0;
  let encoded = '';
  const http = new HttpResponseScope({
    fetch: async (_input, init) => {
      calls++;
      encoded = new TextDecoder().decode(init?.body as ArrayBuffer);
      return Response.json({});
    },
  });
  const runtime = createWorkerTelemetry({
    serviceName: 'fixture',
    serviceVersion: '1',
    environment: 'test',
    buildSha: 'fixture',
    registerGlobal: false,
    http,
    timers,
    otlpUrl: 'https://collector.example/v1/traces',
  });
  for (let index = 0; index < 7; index++) {
    runtime.provider.getTracer('fixture').startSpan(`request-${index}`).end();
  }
  await runtime.forceFlush();
  await http.finish();
  expect(calls).toBe(1);
  for (let index = 0; index < 7; index++)
    expect(encoded).toContain(`request-${index}`);
  expect(clock.pendingOneShotCount()).toBe(0);
  await runtime.shutdown();
});
