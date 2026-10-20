import { afterEach, expect, test } from 'bun:test';
import {
  context,
  propagation,
  ROOT_CONTEXT,
  TraceFlags,
  trace,
} from '@opentelemetry/api';
import { InMemorySpanExporter } from '@opentelemetry/sdk-trace-base';
import { observeBackgroundWork } from '@pkgs/observability-root-server/observe-background-work';
import { createWorkerTelemetry } from '@pkgs/observability-root-server/worker-worker';
import { ATTR } from '@pkgs/observability-root-shared/attributes';
import { recordStructuredLog } from '@pkgs/observability-root-shared/log';
import { withSpan } from '@pkgs/observability-root-shared/span';

afterEach(() => {
  trace.disable();
  context.disable();
  propagation.disable();
});

// regression: worker-background-failures-swallowed
test('a late background rejection preserves its error and flushes the diagnostic', async () => {
  const exporter = new InMemorySpanExporter();
  const runtime = createWorkerTelemetry({
    serviceName: 'example-worker',
    serviceVersion: '1',
    environment: 'test',
    buildSha: 'abc',
    exporter,
  });
  const reason = new Error('late outbox failure');
  await expect(
    observeBackgroundWork(Promise.reject(reason), runtime.forceFlush)
  ).rejects.toBe(reason);
  expect(
    exporter
      .getFinishedSpans()
      .some(
        (span) =>
          span.status.code === 2 &&
          span.events.some(
            (event) =>
              event.attributes?.[ATTR.EXCEPTION_MESSAGE] === reason.message
          )
      )
  ).toBe(true);
  await runtime.shutdown();
});

// regression: diagnostic-errors-missing-from-trace-search
test('a background error is searchable as a trace with its redacted stack', async () => {
  const exporter = new InMemorySpanExporter();
  const runtime = createWorkerTelemetry({
    serviceName: 'example-worker',
    serviceVersion: '1',
    environment: 'test',
    buildSha: 'abc',
    exporter,
  });
  const error = new Error(
    'task failed ?code=private-code Bearer private-token'
  );
  recordStructuredLog({
    severity: 'error',
    message: 'background task failed',
    loggerName: 'background',
    context: { error, 'app.room.topic': 'room:friday', password: 'private' },
  });
  await runtime.forceFlush();
  const failure = exporter
    .getFinishedSpans()
    .find((span) => span.name === 'runtime.error');
  expect(failure?.status.code).toBe(2);
  expect(failure?.attributes[ATTR.APP_ROOM_TOPIC]).toBe('room:friday');
  expect(failure?.events[0]?.attributes?.[ATTR.EXCEPTION_STACKTRACE]).toContain(
    'diagnostic-errors.test.ts'
  );
  const serialized = JSON.stringify(failure?.events);
  expect(serialized).not.toContain('private-code');
  expect(serialized).not.toContain('private-token');
  expect(failure?.attributes['password']).toBeUndefined();
  await runtime.shutdown();
});

// regression: warnings-invisible-to-trace-search
test('a warning is searchable as a trace without being a failure', async () => {
  const exporter = new InMemorySpanExporter();
  const runtime = createWorkerTelemetry({
    serviceName: 'example-worker',
    serviceVersion: '1',
    environment: 'test',
    buildSha: 'abc',
    exporter,
  });
  recordStructuredLog({
    severity: 'warn',
    message: 'subscription rejected; refreshing authorization',
    loggerName: 'pubsub',
  });
  await runtime.forceFlush();
  const warning = exporter
    .getFinishedSpans()
    .find((span) => span.name === 'runtime.warning');
  expect(warning?.status.code).toBe(0);
  expect(warning?.attributes[ATTR.APP_LOG_MESSAGE]).toBe(
    'subscription rejected; refreshing authorization'
  );
  expect(warning?.events).toEqual([]);
  expect(
    exporter.getFinishedSpans().some((span) => span.name === 'runtime.error')
  ).toBe(false);
  await runtime.shutdown();
});

// regression: incoming-unsampled-context-hides-server-error
test('an incoming unsampled trace cannot hide a server exception by default', async () => {
  const exporter = new InMemorySpanExporter();
  const runtime = createWorkerTelemetry({
    serviceName: 'example-worker',
    serviceVersion: '1',
    environment: 'test',
    buildSha: 'abc',
    exporter,
  });
  const remote = trace.setSpanContext(ROOT_CONTEXT, {
    traceId: '11111111111111111111111111111111',
    spanId: '2222222222222222',
    isRemote: true,
    traceFlags: TraceFlags.NONE,
  });
  await expect(
    context.with(remote, () =>
      withSpan('request.handle', () => {
        throw new Error('literal unsampled request failure');
      })
    )
  ).rejects.toThrow('literal unsampled request failure');
  await runtime.forceFlush();
  expect(
    exporter.getFinishedSpans().some((span) => span.status.code === 2)
  ).toBe(true);
  await runtime.shutdown();
});

// regression: diagnostic-flush-masks-background-error
test('a synchronous exporter failure preserves the background operation result', async () => {
  const flush = (): Promise<void> => {
    throw new Error('exporter unavailable');
  };
  const original = new Error('literal background failure');
  await expect(
    observeBackgroundWork(Promise.reject(original), flush)
  ).rejects.toBe(original);
  expect(await observeBackgroundWork(Promise.resolve('completed'), flush)).toBe(
    'completed'
  );
});
