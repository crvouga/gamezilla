import { describe, expect, test } from 'bun:test';
import { TempoTraceStore } from '@pkgs/observability-root-shared-ts/tempo';
import type { TruncationNotice } from '@pkgs/observability-root-shared-ts/types';
import { traceIdOf } from './trace-fixtures';

type FakeTrace = {
  readonly atMs: number;
  readonly attributes?: Readonly<Record<string, string>>;
  readonly error?: boolean;
  readonly id: number;
};

const NOW_MS = Date.parse('2026-10-21T09:00:00.000Z');
const HOUR = { startMs: NOW_MS - 3_600_000, endMs: NOW_MS };

/**
 * Tempo as the live service behaves: a search returns the first page of
 * whatever matched, in no order a caller can rely on.
 */
function fakeTempo(traces: readonly FakeTrace[]) {
  const searches: URL[] = [];
  const store = new TempoTraceStore({
    baseUrl: 'https://tempo.example',
    now: () => NOW_MS,
    async fetch(input) {
      const url = new URL(input);
      if (url.pathname === '/api/search') {
        searches.push(url);
        return Response.json({ traces: searchOf(url, traces) });
      }
      const id = url.pathname.split('/').pop() ?? '';
      const found = traces.find((trace) => traceIdOf(trace.id) === id);
      if (found === undefined) return new Response('', { status: 404 });
      return Response.json({
        traceId: id,
        spanId: '00000000000000aa',
        name: found.error === true ? 'outbox.drain' : 'http.server.request',
        startTimeMs: found.atMs,
        durationMs: 4,
        status: found.error === true ? 'error' : 'ok',
        attributes: found.attributes ?? {},
      });
    },
  });
  return { searches, store };
}

function searchOf(url: URL, traces: readonly FakeTrace[]): unknown[] {
  const startS = Number(url.searchParams.get('start'));
  const endS = Number(url.searchParams.get('end'));
  const limit = Number(url.searchParams.get('limit'));
  const query = url.searchParams.get('q') ?? '';
  return traces
    .filter((trace) => {
      const second = trace.atMs / 1000;
      if (second < startS || second > endS) return false;
      if (query === '{ status = error }') return trace.error === true;
      const wanted = /"([^"]+)" = "([^"]+)"/.exec(query);
      if (wanted === null) return true;
      return trace.attributes?.[wanted[1] ?? ''] === wanted[2];
    })
    .sort((a, b) => a.atMs - b.atMs) // the oldest page, not the newest
    .slice(0, limit)
    .map((trace) => ({
      traceID: traceIdOf(trace.id),
      startTimeUnixNano: String(trace.atMs * 1_000_000),
      rootTraceName: 'x',
    }));
}

function busyHour(): FakeTrace[] {
  const ok = Array.from({ length: 130 }, (_, index) => ({
    id: index + 1,
    atMs: HOUR.startMs + (index + 1) * 20_000,
  }));
  return [...ok, { id: 999, atMs: NOW_MS - 30 * 60_000, error: true }];
}

describe('recent activity from Tempo', () => {
  // regression: obs-last-omits-newest-error-trace
  test('the newest error trace is returned first even when 130 quiet traces share the hour', async () => {
    const { store } = fakeTempo(busyHour());
    const refs = await store.recent(HOUR);
    expect(refs[0]?.traceId).toBe(traceIdOf(999));
    expect(refs[0]?.errorCount).toBe(1);
  });

  test('the same hour gives the same answer however Tempo orders its page', async () => {
    const first = await fakeTempo(busyHour()).store.recent(HOUR);
    const second = await fakeTempo([...busyHour()].reverse()).store.recent(
      HOUR
    );
    expect(second.map((ref) => ref.traceId)).toEqual(
      first.map((ref) => ref.traceId)
    );
  });

  test('without errors the newest traces are kept, not an arbitrary page', async () => {
    const quiet = busyHour().filter((trace) => trace.error !== true);
    const refs = await fakeTempo(quiet).store.recent(HOUR);
    const newest = quiet.at(-1);
    expect(refs[0]?.traceId).toBe(traceIdOf(newest?.id ?? 0));
    expect(refs).toHaveLength(50);
  });

  test('stopping at the limit is announced', async () => {
    const notices: TruncationNotice[] = [];
    const quiet = busyHour().filter((trace) => trace.error !== true);
    await fakeTempo(quiet).store.recent(HOUR, {
      onTruncated: (notice) => notices.push(notice),
    });
    expect(notices).toEqual([
      { search: '{ true }', kept: 50, reason: 'limit' },
    ]);
  });
});

describe('trace ids from Tempo', () => {
  test('are the 32 digits a person can paste back into bun obs trace', async () => {
    const store = new TempoTraceStore({
      baseUrl: 'https://tempo.example',
      now: () => NOW_MS,
      async fetch(input) {
        const url = new URL(input);
        if (url.pathname === '/api/search') {
          return Response.json({
            // Tempo lists this id without its leading zero.
            traces: [{ traceID: 'a1d8b860c7d3954f3d61077a354bf79' }],
          });
        }
        return Response.json({
          traceId: url.pathname.split('/').pop(),
          spanId: '00000000000000aa',
          name: 'outbox.drain',
          startTimeMs: NOW_MS - 1_000,
          durationMs: 4,
          status: 'error',
        });
      },
    });
    const refs = await store.recent(HOUR);
    expect(refs[0]?.traceId).toBe('0a1d8b860c7d3954f3d61077a354bf79');
  });
});

describe('searching by session and device', () => {
  // regression: obs-session-device-search-ignores-window
  test('are bounded by the asked window, not a fixed lookback', async () => {
    const { searches, store } = fakeTempo([]);
    await store.findBySession('s-1', HOUR);
    await store.findByDevice('d-1', HOUR);
    expect(searches).toHaveLength(2);
    for (const url of searches) {
      expect(url.searchParams.get('start')).toBe(String(HOUR.startMs / 1000));
      expect(url.searchParams.get('end')).toBe(String(HOUR.endMs / 1000));
    }
    expect(searches[0]?.searchParams.get('q')).toContain(
      '"session.id" = "s-1"'
    );
    expect(searches[1]?.searchParams.get('q')).toContain(
      '"app.device.id" = "d-1"'
    );
  });

  test('a session match outside the window is not returned', async () => {
    const { store } = fakeTempo([
      {
        id: 1,
        atMs: HOUR.startMs - 10 * 60_000,
        attributes: { 'session.id': 's-1' },
      },
      {
        id: 2,
        atMs: HOUR.startMs + 10 * 60_000,
        attributes: { 'session.id': 's-1' },
      },
    ]);
    const refs = await store.findBySession('s-1', HOUR);
    expect(refs.map((ref) => ref.traceId)).toEqual([traceIdOf(2)]);
  });

  test('the nearest earlier and later activity needs one trace each, not a page', async () => {
    const { searches, store } = fakeTempo([
      { id: 1, atMs: NOW_MS - 5 * 3_600_000 },
      { id: 2, atMs: NOW_MS - 4 * 3_600_000 },
    ]);
    const near = await store.adjacent({
      startMs: NOW_MS - 3_600_000,
      endMs: NOW_MS,
    });
    expect(near.before?.traceId).toBe(traceIdOf(2));
    expect(searches.length).toBeGreaterThan(0);
  });
});
