import { afterEach, expect, test } from 'bun:test';
import { context, metrics, propagation, trace } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { InMemoryLogRecordExporter } from '@opentelemetry/sdk-logs';
import { InMemorySpanExporter } from '@opentelemetry/sdk-trace-base';
import { createWorkerTelemetry } from '@pkgs/observability-root-server-ts/worker-worker';
import { ATTR } from '@pkgs/observability-root-shared-ts/attributes';
import { recordStructuredLog } from '@pkgs/observability-root-shared-ts/log';
import { ReproducibleError } from '@pkgs/observability-root-shared-ts/reproducible-error';
import { withSpan } from '@pkgs/observability-root-shared-ts/span';

afterEach(() => {
  trace.disable();
  context.disable();
  propagation.disable();
  metrics.disable();
  logs.disable();
});

test('root traces keep complete replay bytes beyond the independent log signal budget', async () => {
  const spans = new InMemorySpanExporter();
  const logExporter = new InMemoryLogRecordExporter();
  const runtime = createWorkerTelemetry({
    serviceName: 'example',
    serviceVersion: '1',
    environment: 'test',
    buildSha: 'abc',
    exporter: spans,
    logExporter,
  });
  const value = { seed: 'race', state: { positions: '🦦'.repeat(300) } };
  const error = new ReproducibleError(
    'literal failure',
    {},
    { format: 'example.v1', value }
  );
  try {
    await expect(
      withSpan('example.run', () => {
        throw error;
      })
    ).rejects.toBe(error);
    recordStructuredLog({
      severity: 'error',
      message: 'example stopped',
      loggerName: 'example',
      context: { error },
    });
    await runtime.forceFlush();
    expect(spans.getFinishedSpans()).toHaveLength(2);
    for (const name of ['example.run', 'runtime.error']) {
      const span = spans
        .getFinishedSpans()
        .find((entry) => entry.name === name);
      expect(span?.status.code).toBe(2);
      expect(
        JSON.parse(String(span?.attributes[ATTR.APP_ERROR_REPRODUCTION]))
      ).toEqual(value);
      expect(span?.events[0]?.attributes?.[ATTR.EXCEPTION_MESSAGE]).toBe(
        'literal failure'
      );
    }
    expect(logExporter.getFinishedLogRecords()).toHaveLength(1);
    expect(
      logExporter.getFinishedLogRecords()[0]?.attributes[
        ATTR.APP_ERROR_REPRODUCTION
      ]
    ).toBeUndefined();
    expect(
      logExporter.getFinishedLogRecords()[0]?.attributes[ATTR.EXCEPTION_MESSAGE]
    ).toBe('literal failure');
  } finally {
    await runtime.shutdown();
  }
});
