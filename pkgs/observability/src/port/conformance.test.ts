import { describe, expect, test } from 'bun:test';
import { wallIo } from '@pkgs/io';
import { createLocalFileObservabilityWithExporter } from '../impl-local-file/impl-local-file';
import { createLoggerObservabilityWithExporter } from '../impl-logger/impl-logger';
import { createNoopObservability } from '../impl-noop/impl-noop';
import { isSlowSpan, slowThresholdMsForSpan } from '../shared/slow-thresholds';
import { TRACEPARENT_HEADER } from '../shared/trace-context';
import type { ExportedSpanRecord, HttpFetchFn } from '../shared/types';
import { InMemorySpanContextStorage } from './in-memory-context-storage';
import type { Observability } from './observability';

const io = wallIo();

type Factory = { readonly name: string; create: () => Observability };

function conformanceSuite(factory: Factory): void {
  describe(factory.name, () => {
    test('span lifecycle does not throw', () => {
      const obs = factory.create();
      const span = obs.startSpan({ name: 'test.span', kind: 'internal' });
      span.setAttribute('key', 'value');
      span.addEvent('evt', { n: 1 });
      span.setStatus({ code: 'ok' });
      expect(() => span.end()).not.toThrow();
    });

    test('inject/extract round-trip', () => {
      const obs = factory.create();
      const span = obs.startSpan({ name: 'propagation' });
      const carrier: Record<string, string> = {};
      obs.inject(span.spanContext, carrier);
      expect(carrier[TRACEPARENT_HEADER]).toBeDefined();
      const extracted = obs.extract(carrier);
      expect(extracted?.traceId).toBe(span.spanContext.traceId);
      expect(extracted?.spanId).toBe(span.spanContext.spanId);
      span.end();
    });

    test('recordException does not throw', () => {
      const obs = factory.create();
      const span = obs.startSpan({ name: 'parent' });
      obs.withSpanContext(span.spanContext, () => {
        expect(() =>
          obs.recordException(new Error('boom'), { where: 'test' })
        ).not.toThrow();
      });
      span.end();
    });

    test('parent/child share traceId', () => {
      const obs = factory.create();
      const parent = obs.startSpan({ name: 'parent' });
      const child = obs.startSpan({
        name: 'child',
        parent: parent.spanContext,
      });
      expect(child.spanContext.traceId).toBe(parent.spanContext.traceId);
      expect(child.spanContext.spanId).not.toBe(parent.spanContext.spanId);
      child.end();
      parent.end();
    });
  });
}

describe('Observability port conformance', () => {
  conformanceSuite({
    name: 'noop',
    create: () => createNoopObservability('test-noop'),
  });

  conformanceSuite({
    name: 'local-file',
    create: () => {
      const exported: ExportedSpanRecord[] = [];
      return createLocalFileObservabilityWithExporter({
        serviceName: 'test-local',
        now: io.clock.now,
        createId: io.createId,
        exporter: (r) => exported.push(r),
        storage: new InMemorySpanContextStorage(),
      });
    },
  });

  conformanceSuite({
    name: 'logger',
    create: () => {
      const exported: ExportedSpanRecord[] = [];
      return createLoggerObservabilityWithExporter({
        serviceName: 'test-logger',
        now: io.clock.now,
        createId: io.createId,
        exporter: (r) => exported.push(r),
        storage: new InMemorySpanContextStorage(),
      });
    },
  });

  test('noop startSpan/end is cheap and does not call fetch', async () => {
    let fetchCalls = 0;
    const g = globalThis as Record<string, unknown>;
    const prev = g['fetch'];
    const mockFetch: HttpFetchFn = () => {
      fetchCalls += 1;
      return Promise.resolve(new Response('{}'));
    };
    g['fetch'] = mockFetch;
    try {
      const obs = createNoopObservability('noop-fetch');
      obs.startSpan({ name: 'x' }).end();
      expect(fetchCalls).toBe(0);
    } finally {
      g['fetch'] = prev;
    }
  });
});

describe('slow thresholds', () => {
  test('db.query default threshold is 100ms', () => {
    expect(slowThresholdMsForSpan('db.query')).toBe(100);
  });

  test('isSlowSpan respects threshold', () => {
    expect(isSlowSpan('db.query', 99)).toBe(false);
    expect(isSlowSpan('db.query', 100)).toBe(true);
  });
});
