import { afterEach, describe, expect, test } from 'bun:test';
import { context, propagation, trace } from '@opentelemetry/api';
import type { SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { InMemorySpanExporter } from '@opentelemetry/sdk-trace-base';
import { createNodeTelemetry } from '@pkgs/observability-root-server/node-node';
import { ATTR } from '@pkgs/observability-root-shared/attributes';
import {
  currentCorrelation,
  deserializeTraceContext,
  linkFromTraceparent,
  serializeTraceContext,
} from '@pkgs/observability-root-shared/correlation';
import {
  addEvent,
  EVENT,
  events,
} from '@pkgs/observability-root-shared/events';
import { recordLogEvent } from '@pkgs/observability-root-shared/log';
import type { NarrateSpan } from '@pkgs/observability-root-shared/narrate';
import { narrate } from '@pkgs/observability-root-shared/narrate';
import {
  allowlistedAttributes,
  createAllowlistRedactor,
} from '@pkgs/observability-root-shared/redaction';
import {
  activeSpan,
  startFlushScope,
  startSpan,
  withSpan,
} from '@pkgs/observability-root-shared/span';

afterEach(() => {
  trace.disable();
  context.disable();
  propagation.disable();
});

describe('OTel core', () => {
  test('span status descriptions cannot bypass exception redaction', async () => {
    // regression: otel-status-message-privacy
    const exporter = new InMemorySpanExporter();
    const runtime = createNodeTelemetry({
      serviceName: 'status-test',
      serviceVersion: '1',
      environment: 'test',
      buildSha: 'abc',
      exporter,
    });
    await expect(
      withSpan('test.status', () => {
        throw new Error('failed Bearer status-token person@example.com');
      })
    ).rejects.toThrow('failed');
    await runtime.forceFlush();
    expect(exporter.getFinishedSpans()[0]?.status.message).toBe(
      'failed Bearer [redacted] [email-redacted]'
    );
    await runtime.shutdown();
  });
  test('keeps active parentage, stamps identity, and redacts before export', async () => {
    const exporter = new InMemorySpanExporter();
    const runtime = createNodeTelemetry({
      serviceName: 'core-test',
      serviceVersion: '1',
      environment: 'test',
      buildSha: 'abc',
      exporter,
      identity: () => ({
        userId: 'user-1',
        sessionId: 'session-1',
        deviceId: 'device-1',
        buildSha: 'abc',
      }),
    });

    await withSpan('test.parent', async (parent) => {
      parent.setAttribute('secret.token', 'must-not-export');
      events.mutationEnqueued(parent, 'mutation-1');
      await withSpan('test.child', async () => Promise.resolve());
    });
    await runtime.forceFlush();

    const spans = exporter.getFinishedSpans();
    const parent = spans.find((span) => span.name === 'test.parent');
    const child = spans.find((span) => span.name === 'test.child');
    expect(parent?.attributes[ATTR.USER_ID]).toBe('user-1');
    expect(parent?.attributes['secret.token']).toBeUndefined();
    expect(parent?.events[0]?.name).toBe(EVENT.MUTATION_ENQUEUED);
    expect(child?.parentSpanContext?.spanId).toBe(parent?.spanContext().spanId);
    await runtime.shutdown();
  });

  test('redaction is final and bounds credential-bearing allowed text', async () => {
    const exporter = new InMemorySpanExporter();
    const lateProcessor: SpanProcessor = {
      onStart() {},
      onEnding(span) {
        span.setAttribute('late.secret', 'must-not-export');
      },
      onEnd() {},
      forceFlush: () => Promise.resolve(),
      shutdown: () => Promise.resolve(),
    };
    const runtime = createNodeTelemetry({
      serviceName: 'redaction-test',
      serviceVersion: '1',
      environment: 'test',
      buildSha: 'abc',
      exporter,
      spanProcessors: [lateProcessor],
    });
    await withSpan('test.redaction', (span) => {
      span.setAttribute(
        ATTR.APP_LOG_MESSAGE,
        `Bearer exposed-token ${'x'.repeat(700)}`
      );
    });
    await runtime.forceFlush();
    const attributes = exporter.getFinishedSpans()[0]?.attributes ?? {};
    expect(attributes['late.secret']).toBeUndefined();
    expect(attributes[ATTR.APP_LOG_MESSAGE]).not.toContain('exposed-token');
    expect(String(attributes[ATTR.APP_LOG_MESSAGE]).length).toBeLessThanOrEqual(
      512
    );
    await runtime.shutdown();
  });

  test('records callback failures and preserves exception details', async () => {
    const exporter = new InMemorySpanExporter();
    const runtime = createNodeTelemetry({
      serviceName: 'error-test',
      serviceVersion: '1',
      environment: 'test',
      buildSha: 'abc',
      exporter,
    });

    await expect(
      withSpan('test.failure', () => {
        throw new Error('broken');
      })
    ).rejects.toThrow('broken');
    await runtime.forceFlush();
    const failed = exporter.getFinishedSpans()[0];
    expect(failed?.status.code).toBe(2);
    expect(failed?.events[0]?.attributes?.[ATTR.EXCEPTION_MESSAGE]).toBe(
      'broken'
    );
    expect(
      failed?.events[0]?.attributes?.[ATTR.EXCEPTION_STACKTRACE]
    ).toContain('Error: broken');
    await runtime.shutdown();
  });

  test('serializes and restores W3C correlation', async () => {
    const runtime = createNodeTelemetry({
      serviceName: 'correlation-test',
      serviceVersion: '1',
      environment: 'test',
      buildSha: 'abc',
      exporter: new InMemorySpanExporter(),
    });
    await withSpan('test.correlation', () => {
      const correlation = currentCorrelation();
      const traceparent = serializeTraceContext();
      expect(traceparent).toContain(correlation.traceId);
      expect(deserializeTraceContext(traceparent ?? '')).toBeDefined();
      expect(linkFromTraceparent(traceparent ?? '')?.context.traceId).toBe(
        correlation.traceId
      );
    });
    expect(deserializeTraceContext('invalid')).toBeUndefined();
    expect(linkFromTraceparent('invalid')).toBeUndefined();
    expect(currentCorrelation()).toEqual({});
    await runtime.shutdown();
  });

  test('records correlated logs only on the active span', async () => {
    const exporter = new InMemorySpanExporter();
    const runtime = createNodeTelemetry({
      serviceName: 'log-test',
      serviceVersion: '1',
      environment: 'test',
      buildSha: 'abc',
      exporter,
    });
    recordLogEvent({
      severity: 'info',
      message: 'startup',
      loggerName: 'test',
    });
    await withSpan('test.log', () => {
      recordLogEvent({
        severity: 'warn',
        message: 'correlated',
        loggerName: 'test',
      });
    });
    await runtime.forceFlush();
    const event = exporter.getFinishedSpans()[0]?.events[0];
    expect(event?.name).toBe(EVENT.LOG_EMITTED);
    expect(event?.attributes?.[ATTR.APP_LOG_SEVERITY]).toBe('warn');
    expect(event?.attributes?.[ATTR.APP_LOG_MESSAGE]).toBe('correlated');
    await runtime.shutdown();
  });

  test('allowlist redacts text arrays and preserves explicitly approved values', () => {
    const redactor = createAllowlistRedactor(new Set(['app.test.extra']));
    expect(redactor('not.allowed', 'value')).toBeUndefined();
    expect(redactor('app.test.extra', 7)).toBe(7);
    expect(
      redactor(ATTR.APP_LOG_MESSAGE, [
        'person@example.com',
        null,
        '?token=secret-value',
      ])
    ).toEqual(['[email-redacted]', null, '?token=[redacted]']);
    expect(
      allowlistedAttributes({
        [ATTR.APP_LOG_MESSAGE]: 'Bearer credential',
        'not.allowed': 'secret',
        undefined: undefined,
      })
    ).toEqual({ [ATTR.APP_LOG_MESSAGE]: 'Bearer [redacted]' });
  });

  test('disposable form closes a leaf span', async () => {
    const exporter = new InMemorySpanExporter();
    const runtime = createNodeTelemetry({
      serviceName: 'disposable-test',
      serviceVersion: '1',
      environment: 'test',
      buildSha: 'abc',
      exporter,
    });
    {
      using span = startSpan('test.leaf');
      span.setAttribute(ATTR.APP_TEST_ID, 'leaf-test');
    }
    await runtime.forceFlush();
    expect(exporter.getFinishedSpans().map((span) => span.name)).toEqual([
      'test.leaf',
    ]);
    await runtime.shutdown();
  });

  test('records the complete typed mutation and sync event vocabulary', async () => {
    const exporter = new InMemorySpanExporter();
    const runtime = createNodeTelemetry({
      serviceName: 'events-test',
      serviceVersion: '1',
      environment: 'test',
      buildSha: 'abc',
      exporter,
    });
    await withSpan('test.events', (span) => {
      events.mutationAppliedOptimistically(span, 'mutation-1');
      events.mutationPersisted(span, 'mutation-1');
      events.mutationEnqueued(span, 'mutation-1');
      events.mutationSent(span, 'mutation-1');
      events.mutationAcked(span, 'mutation-1');
      events.mutationRebased(span, 'mutation-1');
      events.mutationConflict(span, 'mutation-1');
      events.mutationRolledBack(span, 'mutation-1');
      events.mutationRejected(span, 'mutation-1');
      events.syncBatchFlushed(span, 3);
      events.syncClockSkewObserved(span, 42);
      addEvent(span, EVENT.SYNC_CONNECTED, {
        [ATTR.APP_DEVICE_ID]: 'device-1',
      });
    });
    await runtime.forceFlush();

    const recorded = exporter.getFinishedSpans()[0]?.events ?? [];
    expect(recorded.map((event) => event.name)).toEqual([
      EVENT.MUTATION_APPLIED_OPTIMISTICALLY,
      EVENT.MUTATION_PERSISTED,
      EVENT.MUTATION_ENQUEUED,
      EVENT.MUTATION_SENT,
      EVENT.MUTATION_ACKED,
      EVENT.MUTATION_REBASED,
      EVENT.MUTATION_CONFLICT,
      EVENT.MUTATION_ROLLED_BACK,
      EVENT.MUTATION_REJECTED,
      EVENT.SYNC_BATCH_FLUSHED,
      EVENT.SYNC_CLOCK_SKEW_OBSERVED,
      EVENT.SYNC_CONNECTED,
    ]);
    expect(recorded[9]?.attributes?.[ATTR.APP_SYNC_BATCH_SIZE]).toBe(3);
    expect(recorded[10]?.attributes?.[ATTR.APP_CLOCK_SKEW_MS]).toBe(42);
    await runtime.shutdown();
  });

  test('flush scope closes, flushes, and activeSpan follows callback context', async () => {
    const exporter = new InMemorySpanExporter();
    const runtime = createNodeTelemetry({
      serviceName: 'flush-test',
      serviceVersion: '1',
      environment: 'test',
      buildSha: 'abc',
      exporter,
    });
    let flushes = 0;
    await withSpan('test.active', (span) => {
      expect(activeSpan()?.spanContext().spanId).toBe(
        span.spanContext().spanId
      );
    });
    {
      await using scope = startFlushScope('test.flush', async () => {
        flushes += 1;
        await runtime.forceFlush();
      });
      scope.setAttribute(ATTR.APP_TEST_ID, 'flush-test');
    }
    expect(activeSpan()).toBeUndefined();
    expect(flushes).toBe(1);
    expect(exporter.getFinishedSpans().map((span) => span.name)).toContain(
      'test.flush'
    );
    await runtime.shutdown();
  });

  test('normalizes non-Error callback failures', async () => {
    const exporter = new InMemorySpanExporter();
    const runtime = createNodeTelemetry({
      serviceName: 'unknown-error-test',
      serviceVersion: '1',
      environment: 'test',
      buildSha: 'abc',
      exporter,
    });
    await expect(
      withSpan('test.unknown_failure', () => {
        throw 'string-failure';
      })
    ).rejects.toBe('string-failure');
    await runtime.forceFlush();
    const failed = exporter.getFinishedSpans()[0];
    expect(failed?.status.message).toBe('string-failure');
    expect(failed?.events[0]?.attributes?.[ATTR.EXCEPTION_MESSAGE]).toBe(
      'string-failure'
    );
    await runtime.shutdown();
  });
});

test('narrate is deterministic, compact, and expands errors and gaps', () => {
  const spans: NarrateSpan[] = [
    {
      traceId: 'trace-1',
      spanId: 'span-2',
      name: 'server.request',
      startTimeMs: 2_000,
      durationMs: 10,
      status: 'error',
      statusMessage: 'failed',
      attributes: { [ATTR.USER_ID]: 'user-1' },
      events: [
        {
          name: 'exception',
          timeMs: 2_001,
          attributes: {
            [ATTR.EXCEPTION_TYPE]: 'Error',
            [ATTR.EXCEPTION_MESSAGE]: 'constraint failed',
            [ATTR.EXCEPTION_STACKTRACE]:
              'Error: constraint failed\n at db.ts:1',
          },
        },
      ],
      links: [{ traceId: 'trace-0', spanId: 'span-0' }],
    },
    {
      traceId: 'trace-1',
      spanId: 'span-1',
      name: 'client.interaction',
      startTimeMs: 0,
      durationMs: 5,
      status: 'ok',
      attributes: {},
      events: [
        {
          name: EVENT.LOG_EMITTED,
          timeMs: 3,
          attributes: {
            [ATTR.APP_LOG_SEVERITY]: 'warn',
            [ATTR.APP_LOG_MESSAGE]: 'connection shaky',
            [ATTR.APP_LOG_NAME]: 'sync',
          },
        },
      ],
    },
  ];
  const output = narrate(spans);
  expect(output).toContain('gap 2.00s');
  expect(output).toContain('constraint failed');
  expect(output).toContain('caused by trace-0/span-0');
  expect(output).toContain('log WARN sync: connection shaky');
  expect(output.length).toBeLessThan(8_000);
});

test('narrate prioritizes late errors and enforces a character budget', () => {
  const healthy = Array.from(
    { length: 100 },
    (_, index): NarrateSpan => ({
      traceId: 'trace-budget',
      spanId: `healthy-${String(index).padStart(3, '0')}`,
      name: 'request.healthy',
      startTimeMs: index,
      durationMs: 1,
      status: 'ok',
      attributes: { [ATTR.DB_QUERY_TEXT]: 'select value from healthy_table' },
    })
  );
  const lateError: NarrateSpan = {
    traceId: 'trace-budget',
    spanId: 'late-error',
    name: 'db.query',
    startTimeMs: 10_000,
    durationMs: 20,
    status: 'error',
    statusMessage: `constraint failed\n${'private detail '.repeat(200)}`,
    attributes: { [ATTR.CODE_FILE_PATH]: 'libs/example/src/query.ts' },
  };
  const output = narrate([...healthy, lateError], {
    maxChars: 2_000,
    maxLines: 40,
  });
  expect(output).toContain('db.query [ERROR]');
  expect(output).toContain('libs/example/src/query.ts');
  expect(output).not.toContain('\nprivate detail');
  expect(output.length).toBeLessThanOrEqual(2_100);
});
