import { afterEach, describe, expect, test } from 'bun:test';
import { context, propagation, trace } from '@opentelemetry/api';
import { InMemorySpanExporter } from '@opentelemetry/sdk-trace-base';
import {
  CONTEXT_CAPABILITY as BROWSER_CONTEXT_CAPABILITY,
  createBrowserTelemetry,
  instrumentFetch,
} from '@pkgs/observability-root-client-ts/browser';
import {
  createNodeTelemetry,
  CONTEXT_CAPABILITY as NODE_CONTEXT_CAPABILITY,
} from '@pkgs/observability-root-server-ts/node-node';
import {
  createWorkerTelemetry,
  extractRequestContext,
  injectRequestHeaders,
  CONTEXT_CAPABILITY as WORKER_CONTEXT_CAPABILITY,
} from '@pkgs/observability-root-server-ts/worker-worker';
import { ATTR } from '@pkgs/observability-root-shared-ts/attributes';
import { withSpan } from '@pkgs/observability-root-shared-ts/span';

const BASE_OPTIONS = {
  serviceName: 'conformance',
  serviceVersion: '1',
  environment: 'test' as const,
  buildSha: 'abc',
  registerGlobal: false,
  identity: () => ({ userId: 'conformance-user' }),
};

afterEach(() => {
  trace.disable();
  context.disable();
  propagation.disable();
});

describe('runtime adapter conformance', () => {
  test('browser flushes on visibility change and shutdown', async () => {
    const exporter = new InMemorySpanExporter();
    let visibilityListener: (() => void) | undefined;
    const runtime = createBrowserTelemetry({
      ...BASE_OPTIONS,
      exporter,
      document: {
        addEventListener(
          _name: string,
          listener: EventListenerOrEventListenerObject
        ) {
          visibilityListener = listener as () => void;
        },
        removeEventListener() {},
      },
    });
    const span = runtime.provider.getTracer('test').startSpan('browser.span');
    span.setAttribute('secret.token', 'redact-me');
    span.end();
    visibilityListener?.();
    await Promise.resolve();
    expect(exporter.getFinishedSpans()[0]?.name).toBe('browser.span');
    expect(exporter.getFinishedSpans()[0]?.attributes[ATTR.USER_ID]).toBe(
      'conformance-user'
    );
    expect(
      exporter.getFinishedSpans()[0]?.attributes['secret.token']
    ).toBeUndefined();
    await runtime.shutdown();
  });

  test('browser fetch creates a connected child and propagates traceparent', async () => {
    const exporter = new InMemorySpanExporter();
    let outboundTraceparent: string | null = null;
    const fetchWithCapture = (
      _input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      outboundTraceparent = new Headers(init?.headers).get('traceparent');
      return Promise.resolve(new Response(null, { status: 204 }));
    };
    const runtime = createBrowserTelemetry({
      ...BASE_OPTIONS,
      registerGlobal: true,
      exporter,
      propagateTraceHeaderCorsUrls: [/^https:\/\/allowed\.example/],
      instrumentFetch: false,
    });
    try {
      const fetch = instrumentFetch(fetchWithCapture);
      await withSpan('browser.interaction', async () => {
        await fetch('https://allowed.example/api');
      });
      await runtime.forceFlush();
      const parent = exporter
        .getFinishedSpans()
        .find((span) => span.name === 'browser.interaction');
      const child = exporter
        .getFinishedSpans()
        .find((span) => span.name !== 'browser.interaction');
      expect(parent).toBeDefined();
      expect(String(outboundTraceparent)).toContain(
        parent?.spanContext().traceId ?? 'missing-trace'
      );
      expect(child?.parentSpanContext?.spanId).toBe(
        parent?.spanContext().spanId
      );
    } finally {
      await runtime.shutdown();
    }
  });

  test('worker schedules request-lifetime flush', async () => {
    const exporter = new InMemorySpanExporter();
    const runtime = createWorkerTelemetry({ ...BASE_OPTIONS, exporter });
    const span = runtime.provider.getTracer('test').startSpan('worker.span');
    span.setAttribute('secret.token', 'redact-me');
    span.end();
    let scheduled: Promise<unknown> | undefined;
    runtime.flushWith((promise) => {
      scheduled = promise;
    });
    await scheduled;
    expect(exporter.getFinishedSpans()[0]?.name).toBe('worker.span');
    expect(exporter.getFinishedSpans()[0]?.attributes[ATTR.USER_ID]).toBe(
      'conformance-user'
    );
    expect(
      exporter.getFinishedSpans()[0]?.attributes['secret.token']
    ).toBeUndefined();
    await runtime.shutdown();
  });

  test('worker continues inbound context and injects outbound headers', async () => {
    const exporter = new InMemorySpanExporter();
    const runtime = createWorkerTelemetry({
      ...BASE_OPTIONS,
      registerGlobal: true,
      exporter,
    });
    const inboundTraceId = '0123456789abcdef0123456789abcdef';
    const inbound = new Headers({
      traceparent: `00-${inboundTraceId}-0123456789abcdef-01`,
    });
    const outbound = new Headers();
    await context.with(extractRequestContext(inbound), () =>
      withSpan('worker.request', () => {
        injectRequestHeaders(outbound);
      })
    );
    await runtime.forceFlush();
    expect(exporter.getFinishedSpans()[0]?.spanContext().traceId).toBe(
      inboundTraceId
    );
    expect(outbound.get('traceparent')).toContain(inboundTraceId);
    await runtime.shutdown();
  });

  test('node force-flushes completed spans', async () => {
    const exporter = new InMemorySpanExporter();
    const runtime = createNodeTelemetry({ ...BASE_OPTIONS, exporter });
    const span = runtime.provider.getTracer('test').startSpan('node.span');
    span.setAttribute('secret.token', 'redact-me');
    span.end();
    await runtime.forceFlush();
    expect(exporter.getFinishedSpans()[0]?.name).toBe('node.span');
    expect(exporter.getFinishedSpans()[0]?.attributes[ATTR.USER_ID]).toBe(
      'conformance-user'
    );
    expect(
      exporter.getFinishedSpans()[0]?.attributes['secret.token']
    ).toBeUndefined();
    await runtime.shutdown();
  });

  test('declares context semantics explicitly', () => {
    expect(BROWSER_CONTEXT_CAPABILITY).toBe('callback');
    expect(NODE_CONTEXT_CAPABILITY).toBe('async-context');
    expect(WORKER_CONTEXT_CAPABILITY).toBe('async-context');
  });
});
