import { describe, expect, test } from 'bun:test';
import { IndexedTraceStore } from '@pkgs/observability-root-shared/indexed';
import { NdjsonTraceStore } from '@pkgs/observability-root-shared/ndjson';
import type { TraceStore } from '@pkgs/observability-root-shared/types';
import type { FixtureSpan } from './trace-fixtures';
import { objectStoreOf, traceIdOf } from './trace-fixtures';

const T0 = Date.parse('2026-10-21T02:00:00.000Z');
const WINDOW = { startMs: T0 - 600_000, endMs: T0 + 600_000 };

const SPANS: FixtureSpan[] = [
  {
    trace: 1,
    atMs: T0 - 3_600_000,
    name: 'a',
    attributes: { 'session.id': 's', 'app.device.id': 'd', 'user.id': 'u' },
  },
  {
    trace: 2,
    atMs: T0,
    name: 'b',
    attributes: { 'session.id': 's', 'app.device.id': 'd', 'user.id': 'u' },
  },
  { trace: 3, atMs: T0 + 60_000, name: 'c', attributes: { 'session.id': 's' } },
  {
    trace: 4,
    atMs: T0 + 3_600_000,
    name: 'd',
    attributes: { 'app.device.id': 'd' },
  },
];

function lines(): string {
  return SPANS.map((span, index) =>
    JSON.stringify({
      timestamp: new Date(span.atMs).toISOString(),
      traceId: traceIdOf(span.trace),
      spanId: String(index + 1).padStart(16, '0'),
      name: span.name,
      durationMs: 1,
      status: 'ok',
      attributes: span.attributes ?? {},
      events: [],
    })
  ).join('\n');
}

const stores: readonly [string, () => TraceStore][] = [
  ['ndjson', () => new NdjsonTraceStore(objectStoreOf(lines()), 'fixture')],
  [
    'indexed',
    () => {
      const ndjson = new NdjsonTraceStore(objectStoreOf(lines()), 'fixture');
      return new IndexedTraceStore('indexed', async () => {
        const traces = await Promise.all(
          [1, 2, 3, 4].map((id) => ndjson.getTrace(traceIdOf(id)))
        );
        return traces.flatMap((trace) => trace?.spans ?? []);
      });
    },
  ],
];

describe.each(stores)(
  '%s store searches by identifier inside a window',
  (_name, make) => {
    // regression: obs-session-device-search-ignores-window
    test('session and device matches outside the window are not returned', async () => {
      const store = make();
      const bySession = await store.findBySession('s', WINDOW);
      expect(bySession.map((ref) => ref.traceId).sort()).toEqual(
        [traceIdOf(2), traceIdOf(3)].sort()
      );
      const byDevice = await store.findByDevice('d', WINDOW);
      expect(byDevice.map((ref) => ref.traceId)).toEqual([traceIdOf(2)]);
      expect(
        (await store.findByUser('u', WINDOW)).map((ref) => ref.traceId)
      ).toEqual([traceIdOf(2)]);
    });

    test('a limit keeps the newest and announces the cut; oldest order flips it', async () => {
      const store = make();
      const wide = { startMs: T0 - 7_200_000, endMs: T0 + 7_200_000 };
      const cuts: number[] = [];
      const newest = await store.findBySession('s', wide, {
        limit: 2,
        onTruncated: (notice) => cuts.push(notice.kept),
      });
      expect(newest.map((ref) => ref.traceId)).toEqual([
        traceIdOf(3),
        traceIdOf(2),
      ]);
      expect(cuts).toEqual([2]);
      const oldest = await store.findBySession('s', wide, {
        limit: 1,
        order: 'oldest',
      });
      expect(oldest.map((ref) => ref.traceId)).toEqual([traceIdOf(1)]);
    });

    test('a window with no match is empty and says nothing was cut', async () => {
      const store = make();
      const cuts: number[] = [];
      expect(
        await store.findByDevice('missing', WINDOW, {
          onTruncated: (notice) => cuts.push(notice.kept),
        })
      ).toEqual([]);
      expect(cuts).toEqual([]);
    });
  }
);
