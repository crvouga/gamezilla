import { expect, test } from 'bun:test';
import { TempoTraceStore } from '@pkgs/observability-root-shared-ts/tempo';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const TRACE_ID = 'c45dc76ca5899f2d5c63b8dc77a034da';
const NOW = Date.parse('2026-11-15T16:36:25.773Z');
const WINDOW = { startMs: NOW - 1_000, endMs: NOW + 1_000 };
const ENVIRONMENT = 'deployment.environment.name';

function sharedTempo(environment: string, names: readonly string[]) {
  const queries: string[] = [];
  const store = new TempoTraceStore({
    baseUrl: 'https://tempo.example',
    environment,
    now: () => NOW,
    async fetch(input) {
      const url = new URL(input);
      if (url.pathname === '/api/search') {
        queries.push(url.searchParams.get('q') ?? '');
        return Response.json({
          traces: [
            { traceID: TRACE_ID, startTimeUnixNano: String(NOW * 1_000_000) },
          ],
        });
      }
      return Response.json({
        resourceSpans: names.map((name, index) => ({
          resource: { attributes: { [ENVIRONMENT]: name } },
          scopeSpans: [
            {
              spans: [
                {
                  traceId: TRACE_ID,
                  spanId: String(index + 1).padStart(16, '0'),
                  name: 'outbox.drain',
                  startTimeMs: NOW,
                  durationMs: 10_923,
                  status: 'error',
                },
              ],
            },
          ],
        })),
      });
    },
  });
  return { store, queries };
}

// regression: obs-environment-shares-all-tempo-traces
test('production diagnostics do not report a development outbox failure from their shared stack', async () => {
  const { store, queries } = sharedTempo('prd', ['dev']);
  expect(await store.recent(WINDOW, { errorsOnly: true })).toEqual([]);
  expect(await store.getTrace(TRACE_ID)).toBeNull();
  expect(queries).toEqual([
    '{ (status = error) && resource."deployment.environment.name" = "prd" }',
  ]);
  expect(store.source).toContain('prd');
});

test('all identifier and adjacent searches are bounded to the selected environment', async () => {
  const { store, queries } = sharedTempo('prd', []);
  await store.recent(WINDOW);
  await store.adjacent(WINDOW);
  await store.findByUser('u', WINDOW);
  await store.findBySession('s', WINDOW);
  await store.findByDevice('d', WINDOW);
  await store.findByMutation('m');
  await store.findByTest('t');
  await store.find('unknown', WINDOW);
  expect(queries.length).toBeGreaterThan(10);
  for (const query of queries)
    expect(query).toEndWith(
      '&& resource."deployment.environment.name" = "prd" }'
    );
});

test('a trace contains only spans from the selected environment', async () => {
  await assertProperty(
    'Tempo environment isolation',
    fc.asyncProperty(
      fc.constantFrom('prd', 'dev', 'preview-42'),
      fc.array(fc.constantFrom('prd', 'dev', 'preview-42'), { maxLength: 15 }),
      async (selected, names) => {
        const { store } = sharedTempo(selected, names);
        const trace = await store.getTrace(TRACE_ID);
        const expected = names.filter((name) => name === selected);
        expect(
          trace?.spans.map((span) => span.attributes[ENVIRONMENT]) ?? []
        ).toEqual(expected);
      }
    )
  );
});
