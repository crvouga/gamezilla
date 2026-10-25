import { afterEach, expect, test } from 'bun:test';
import { reportSolidBoundaryError } from '@libs/app-root-client-ts/browser-boundaries';
import { context, propagation, trace } from '@opentelemetry/api';
import { InMemorySpanExporter } from '@opentelemetry/sdk-trace-base';
import { createWorkerTelemetry } from '@pkgs/observability-root-server-ts/worker-worker';
import { ATTR } from '@pkgs/observability-root-shared-ts/attributes';
import { ReproducibleError } from '@pkgs/observability-root-shared-ts/reproducible-error';

afterEach(() => {
  trace.disable();
  context.disable();
  propagation.disable();
});

test('the existing browser root error keeps a replay diagnostic on its returned trace', async () => {
  const exporter = new InMemorySpanExporter();
  const runtime = createWorkerTelemetry({
    serviceName: 'browser-test',
    serviceVersion: '1',
    environment: 'test',
    buildSha: 'abc',
    exporter,
  });
  try {
    const value = { seed: 'race', tick: 1, input: 4 };
    const error = new ReproducibleError(
      'literal browser failure',
      {},
      { format: 'example.v1', value }
    );
    const id = reportSolidBoundaryError(error);
    await runtime.forceFlush();
    const failure = exporter
      .getFinishedSpans()
      .find((span) => span.name === 'client.error');
    expect(failure?.spanContext().traceId).toBe(id);
    expect(failure?.status.code).toBe(2);
    expect(
      JSON.parse(String(failure?.attributes[ATTR.APP_ERROR_REPRODUCTION]))
    ).toEqual(value);
    expect(failure?.events[0]?.attributes?.[ATTR.EXCEPTION_MESSAGE]).toBe(
      'literal browser failure'
    );
  } finally {
    await runtime.shutdown();
  }
});
