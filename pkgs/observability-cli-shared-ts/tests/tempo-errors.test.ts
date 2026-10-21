import { describe, expect, test } from 'bun:test';
import { parseArgs } from '@pkgs/observability-cli-shared-ts/args';
import { runCommand } from '@pkgs/observability-cli-shared-ts/commands';
import { TempoTraceStore } from '@pkgs/observability-root-shared-ts/tempo';

// regression: tempo-search-hides-errors-without-count-metadata
test('last errors queries errors directly and reads counts from the full trace', async () => {
  const traceId = '11111111111111111111111111111111';
  const nowMs = 1_700_000_010_000;
  let lookups = 0;
  const store = new TempoTraceStore({
    baseUrl: 'https://tempo.example',
    now: () => nowMs,
    fetch: async (input) => {
      const url = new URL(input);
      if (url.pathname === '/api/search') {
        expect(url.searchParams.get('q')).toBe('{ status = error }');
        // This is Tempo's search shape: it has neither errorCount nor spanCount.
        return Response.json({
          traces: [
            {
              traceID: traceId,
              rootTraceName: 'room.schedule',
              startTimeUnixNano: '1700000000000000000',
              durationMs: 1,
            },
          ],
        });
      }
      lookups += 1;
      return Response.json({
        traceId,
        spanId: '2222222222222222',
        name: 'room.schedule',
        startTimeMs: 1_700_000_000_000,
        durationMs: 1,
        status: 'error',
        statusMessage: 'literal room failure',
        events: [
          {
            name: 'exception',
            timeMs: 1_700_000_000_000,
            attributes: {
              'exception.message': 'literal room failure',
              'exception.stacktrace': 'room-handler.ts:42',
            },
          },
        ],
      });
    },
  });
  const result = await runCommand(
    { store, nowMs },
    parseArgs(['last', '--errors'])
  );
  expect(result.code).toBe(0);
  expect(result.text).toContain('ERROR(1)');
  expect(result.text).toContain('1 spans');
  expect(result.text).toContain('literal room failure');
  expect(result.text).toContain('room-handler.ts:42');
  expect(lookups).toBe(1);
});

const BUSY_NOW_MS = Date.parse('2026-10-21T09:00:00.000Z');
const ERROR_TRACE = '00000000000000000000000000000999';

function traceName(index: number): string {
  return index.toString(16).padStart(32, '0');
}

/**
 * Tempo during a busy hour: 130 quiet traces and one newer error trace. A
 * search returns the first page of what matched, oldest first, as Tempo may.
 */
function busyTempo(): TempoTraceStore {
  const quiet = Array.from({ length: 130 }, (_, index) => ({
    id: traceName(index + 1),
    atMs: BUSY_NOW_MS - 3_500_000 + index * 20_000,
    error: false,
  }));
  const all = [
    ...quiet,
    { id: ERROR_TRACE, atMs: BUSY_NOW_MS - 1_800_000, error: true },
  ];
  return new TempoTraceStore({
    baseUrl: 'https://tempo.example',
    now: () => BUSY_NOW_MS,
    fetch: async (input) => {
      const url = new URL(input);
      if (url.pathname === '/api/search') {
        const start = Number(url.searchParams.get('start'));
        const end = Number(url.searchParams.get('end'));
        const errorsOnly = url.searchParams.get('q') === '{ status = error }';
        const page = all
          .filter(
            (item) => item.atMs / 1000 >= start && item.atMs / 1000 <= end
          )
          .filter((item) => !errorsOnly || item.error)
          .sort((a, b) => a.atMs - b.atMs)
          .slice(0, Number(url.searchParams.get('limit')));
        return Response.json({
          traces: page.map((item) => ({
            traceID: item.id,
            startTimeUnixNano: String(item.atMs * 1_000_000),
          })),
        });
      }
      const id = url.pathname.split('/').pop() ?? '';
      const found = all.find((item) => item.id === id);
      if (found === undefined) return new Response('', { status: 404 });
      return Response.json({
        traceId: id,
        spanId: '00000000000000aa',
        name: found.error ? 'outbox.drain' : 'worker.fetch',
        startTimeMs: found.atMs,
        durationMs: 3,
        status: found.error ? 'error' : 'ok',
        ...(found.error ? { statusMessage: 'drain failed' } : {}),
      });
    },
  });
}

describe('a busy hour in Tempo', () => {
  // regression: obs-last-omits-newest-error-trace
  test('last shows the error trace that last --errors shows, first', async () => {
    const plain = await runCommand(
      { store: busyTempo(), nowMs: BUSY_NOW_MS },
      parseArgs(['last', '--window', '1h'])
    );
    const errorsOnly = await runCommand(
      { store: busyTempo(), nowMs: BUSY_NOW_MS },
      parseArgs(['last', '--window', '1h', '--errors'])
    );
    expect(errorsOnly.text).toContain(ERROR_TRACE);
    expect(plain.text).toContain(ERROR_TRACE);
    expect(plain.text.indexOf(ERROR_TRACE)).toBeLessThan(
      plain.text.indexOf(traceName(130))
    );
    expect(plain.text).toContain('drain failed');
  });

  // regression: obs-errors-empty-on-busy-window
  test('errors lists the error trace instead of reporting that none matched', async () => {
    const result = await runCommand(
      { store: busyTempo(), nowMs: BUSY_NOW_MS },
      parseArgs(['errors', '--since', '1h'])
    );
    expect(result.code).toBe(0);
    expect(result.text).toContain(ERROR_TRACE);
    expect(result.text).not.toContain('No traces matched');
  });

  test('a limit that cut the list is announced and --all raises it', async () => {
    const cut = await runCommand(
      { store: busyTempo(), nowMs: BUSY_NOW_MS },
      parseArgs(['last', '--window', '1h'])
    );
    expect(cut.text).toContain(
      'WARNING truncated: { true }: stopped after 50 traces'
    );
    expect(cut.text).toContain('--all');
    const all = await runCommand(
      { store: busyTempo(), nowMs: BUSY_NOW_MS },
      parseArgs(['last', '--window', '1h', '--all'])
    );
    expect(all.text).not.toContain('WARNING truncated');
    expect(
      all.text.split('\n').filter((line) => line.includes('worker.fetch'))
    ).toHaveLength(130);
  });

  test('a window with no errors says so without suggesting an id lookup', async () => {
    const result = await runCommand(
      { store: busyTempo(), nowMs: BUSY_NOW_MS },
      parseArgs(['errors', '--since', '10m'])
    );
    expect(result.code).toBe(1);
    expect(result.text).toContain('No error traces in this range.');
    expect(result.text).not.toContain('bun obs find');
  });
});
