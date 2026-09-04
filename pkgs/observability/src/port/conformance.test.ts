import { describe, expect, test } from 'bun:test';
import { wallClock } from '@pkgs/clock';
import { createLoggerObservabilityWithExporter } from '../impl-logger/impl-logger';
import { createNoopObservability } from '../impl-noop/impl-noop';
import { isSlowSpan, slowThresholdMsForSpan } from '../shared/slow-thresholds';
import type { ExportedSpanRecord, HttpFetchFn } from '../shared/types';
import { InMemorySpanContextStorage } from './in-memory-context-storage';
import { observabilityConformanceSuite } from './observability-conformance';

describe('Observability port conformance', () => {
  observabilityConformanceSuite({
    name: 'noop',
    create: () => createNoopObservability('test-noop'),
  });

  observabilityConformanceSuite({
    name: 'logger',
    create: () => {
      const exported: ExportedSpanRecord[] = [];
      return createLoggerObservabilityWithExporter({
        serviceName: 'test-logger',
        now: wallClock.now,
        createId: () => crypto.randomUUID(),
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
