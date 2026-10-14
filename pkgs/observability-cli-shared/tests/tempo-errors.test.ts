import { expect, test } from 'bun:test';
import { parseArgs } from '@pkgs/observability-cli-shared/args';
import { runCommand } from '@pkgs/observability-cli-shared/commands';
import { TempoTraceStore } from '@pkgs/observability-root-shared/tempo';

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
