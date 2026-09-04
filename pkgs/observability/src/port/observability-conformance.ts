import { describe, expect, test } from 'bun:test';
import { TRACEPARENT_HEADER } from '../shared/trace-context';
import type { Observability } from './observability';

export type ObservabilityConformanceFactory = {
  readonly name: string;
  create: () => Observability;
};

function assertSpanLifecycle(obs: Observability): void {
  const span = obs.startSpan({ name: 'test.span', kind: 'internal' });
  span.setAttribute('key', 'value');
  span.addEvent('evt', { n: 1 });
  span.setStatus({ code: 'ok' });
  expect(() => span.end()).not.toThrow();
}

function assertPropagationRoundTrip(obs: Observability): void {
  const span = obs.startSpan({ name: 'propagation' });
  const carrier: Record<string, string> = {};
  obs.inject(span.spanContext, carrier);
  expect(carrier[TRACEPARENT_HEADER]).toBeDefined();
  const extracted = obs.extract(carrier);
  expect(extracted?.traceId).toBe(span.spanContext.traceId);
  expect(extracted?.spanId).toBe(span.spanContext.spanId);
  span.end();
}

function assertRecordException(obs: Observability): void {
  const span = obs.startSpan({ name: 'parent' });
  const record = () =>
    obs.recordException(new Error('boom'), {
      where: 'test',
    });
  obs.withSpanContext(span.spanContext, () => expect(record).not.toThrow());
  span.end();
}

function assertParentChildTrace(obs: Observability): void {
  const parent = obs.startSpan({ name: 'parent' });
  const child = obs.startSpan({ name: 'child', parent: parent.spanContext });
  expect(child.spanContext.traceId).toBe(parent.spanContext.traceId);
  expect(child.spanContext.spanId).not.toBe(parent.spanContext.spanId);
  child.end();
  parent.end();
}

/**
 * Port conformance every `Observability` backend must satisfy. Backends that
 * ship outside this package (`@pkgs/observability-impl-local-file`) run the
 * same suite from their own `bun:test` file.
 */
export function observabilityConformanceSuite(
  factory: ObservabilityConformanceFactory
): void {
  describe(factory.name, () => {
    test('span lifecycle does not throw', () =>
      assertSpanLifecycle(factory.create()));
    test('inject/extract round-trip', () =>
      assertPropagationRoundTrip(factory.create()));
    test('recordException does not throw', () =>
      assertRecordException(factory.create()));
    test('parent/child share traceId', () =>
      assertParentChildTrace(factory.create()));
  });
}
