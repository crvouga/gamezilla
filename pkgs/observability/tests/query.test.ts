import { describe, expect, test } from 'bun:test';
import type { ObjectStore, StoredObject } from '@pkgs/object-store/interface';
import {
  assertTraceHasSpan,
  LocalExplorerTraceStore,
  NdjsonTraceStore,
  TempoTraceStore,
} from '@pkgs/observability/query';

function memoryStore(files: Readonly<Record<string, string>>): ObjectStore {
  const values = new Map(Object.entries(files));
  return {
    async get(key): Promise<StoredObject | null> {
      const value = values.get(key);
      if (value === undefined) return null;
      const bytes = new TextEncoder().encode(value);
      return {
        body: new Blob([bytes]).stream(),
        contentType: 'application/x-ndjson',
        size: bytes.byteLength,
      };
    },
    async put(key, bytes) {
      values.set(key, new TextDecoder().decode(bytes));
    },
    async head(key) {
      return values.has(key);
    },
    async delete(key) {
      values.delete(key);
    },
    async getUri() {
      return null;
    },
    async listKeys(prefix = '') {
      return [...values.keys()].filter((key) => key.startsWith(prefix)).sort();
    },
    withPrefix(prefix) {
      return memoryStore(
        Object.fromEntries(
          [...values]
            .filter(([key]) => key.startsWith(prefix))
            .map(([key, value]) => [key.slice(prefix.length), value])
        )
      );
    },
  };
}

const TRACE_ID = '11111111111111111111111111111111';

function normalizedSpan(): string {
  return JSON.stringify({
    timestamp: '2026-09-22T12:00:00.000Z',
    serviceName: 'client',
    traceId: TRACE_ID,
    spanId: '2222222222222222',
    name: 'mutation.apply',
    kind: 'client',
    durationMs: 12,
    status: 'error',
    statusMessage: 'constraint failed',
    attributes: {
      'user.id': 'alice',
      'session.id': 'session-1',
      'app.mutation.id': 'mutation-1',
    },
    events: [
      { name: 'app.mutation.conflict', timestamp: '2026-09-22T12:00:00.005Z' },
    ],
  });
}

describe('NDJSON TraceStore', () => {
  test('resolves normalized records by correlation identifiers', async () => {
    const store = new NdjsonTraceStore(
      memoryStore({ 'client/a.ndjson': `${normalizedSpan()}\n{` })
    );
    const found = await store.findByMutation('mutation-1');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      traceId: TRACE_ID,
      errorCount: 1,
      rootName: 'mutation.apply',
    });
    expect((await store.findBySession('session-1'))[0]?.traceId).toBe(TRACE_ID);
  });

  test('finds a mutation id carried only by a lifecycle event', async () => {
    const eventOnly = JSON.stringify({
      traceId: TRACE_ID,
      spanId: '2222222222222223',
      name: 'sync.batch.flush',
      startTimeMs: 1_790_078_400_000,
      durationMs: 4,
      status: 'ok',
      attributes: {},
      events: [
        {
          name: 'app.mutation.sent',
          timeMs: 1_790_078_400_001,
          attributes: { 'app.mutation.id': 'event-only-mutation' },
        },
      ],
    });
    const store = new NdjsonTraceStore(
      memoryStore({ 'client/event.ndjson': `${eventOnly}\n` })
    );
    expect(
      (await store.findByMutation('event-only-mutation'))[0]?.traceId
    ).toBe(TRACE_ID);
  });

  test('reads OTLP resourceSpans and exposes live schema', async () => {
    const otlp = JSON.stringify({
      resourceSpans: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'api-worker' } },
            ],
          },
          scopeSpans: [
            {
              spans: [
                {
                  traceId: TRACE_ID,
                  spanId: '3333333333333333',
                  name: 'db.query',
                  startTimeUnixNano: '1790078400000000000',
                  endTimeUnixNano: '1790078400010000000',
                  status: { code: 1 },
                  attributes: [
                    {
                      key: 'db.system.name',
                      value: { stringValue: 'postgresql' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    const store = new NdjsonTraceStore(
      memoryStore({ 'traces/test.ndjson': otlp })
    );
    expect(
      (await store.getTrace(TRACE_ID))?.spans[0]?.attributes['service.name']
    ).toBe('api-worker');
    expect(await store.schema()).toEqual({
      attributeNames: ['db.system.name', 'service.name'],
      eventNames: [],
      spanNames: ['db.query'],
    });
    const trace = await store.getTrace(TRACE_ID);
    if (trace === null) throw new Error('fixture trace missing');
    expect(() =>
      assertTraceHasSpan(trace, { name: 'db.query', status: 'ok' })
    ).not.toThrow();
    expect(() =>
      assertTraceHasSpan(trace, { name: 'db.insert', status: 'ok' })
    ).toThrow('actual spans: db.query[ok]');
  });
});

describe('remote TraceStore adapters', () => {
  test('Tempo searches are bounded by time and result count', async () => {
    let requested = '';
    const store = new TempoTraceStore({
      baseUrl: 'https://tempo.example',
      now: () => 2_000,
      async fetch(input) {
        requested = input;
        return Response.json({ traces: [] });
      },
    });
    await store.recent({ startMs: 1_000, endMs: 2_000 });
    const url = new URL(requested);
    expect(url.pathname).toBe('/api/search');
    expect(url.searchParams.get('start')).toBe('1');
    expect(url.searchParams.get('end')).toBe('2');
    expect(url.searchParams.get('limit')).toBe('50');
  });

  test('Tempo mutation search covers span, resource, and event attributes', async () => {
    let requested = '';
    const store = new TempoTraceStore({
      baseUrl: 'https://tempo.example',
      now: () => 2_000,
      async fetch(input) {
        requested = input;
        return Response.json({ traces: [] });
      },
    });
    await store.findByMutation('offline-1');
    const query = new URL(requested).searchParams.get('q') ?? '';
    expect(query).toContain('span."app.mutation.id" = "offline-1"');
    expect(query).toContain('resource."app.mutation.id" = "offline-1"');
    expect(query).toContain('event."app.mutation.id" = "offline-1"');
  });

  test('Tempo uses Basic auth for a Grafana Cloud user and read token', async () => {
    let authorization = '';
    const store = new TempoTraceStore({
      baseUrl: 'https://tempo.example',
      now: () => 2_000,
      username: 'stack-123',
      token: 'read-only-token',
      async fetch(_input, init) {
        authorization = new Headers(init?.headers).get('authorization') ?? '';
        return Response.json({ traces: [] });
      },
    });
    await store.recent({ startMs: 1_000, endMs: 2_000 });
    expect(authorization).toBe(`Basic ${btoa('stack-123:read-only-token')}`);
    expect(authorization).not.toContain('Bearer');
  });

  test('Tempo find skips direct trace lookup for non-trace identifiers', async () => {
    const requests: string[] = [];
    const store = new TempoTraceStore({
      baseUrl: 'https://tempo.example',
      now: () => 2_000,
      async fetch(input) {
        requests.push(input);
        return Response.json({ traces: [] });
      },
    });
    expect(
      await store.find('session-that-tempo-would-reject', {
        startMs: 1_000,
        endMs: 2_000,
      })
    ).toBeNull();
    expect(requests.some((request) => request.includes('/api/traces/'))).toBe(
      false
    );
  });

  test('Tempo schema discovers live span and event names from recent traces', async () => {
    const store = new TempoTraceStore({
      baseUrl: 'https://tempo.example',
      now: () => 2_000,
      async fetch(input) {
        const url = new URL(input);
        if (url.pathname === '/api/v2/search/tags') {
          return Response.json({ scopes: [{ tags: ['span.db.system.name'] }] });
        }
        if (url.pathname === '/api/search') {
          return Response.json({ traces: [{ traceID: TRACE_ID }] });
        }
        return Response.json({
          traceId: TRACE_ID,
          spanId: '9999999999999999',
          name: 'db.query',
          startTimeMs: 1_000,
          durationMs: 4,
          attributes: { 'db.system.name': 'postgresql' },
          events: [{ name: 'app.query.plan', timeMs: 1_001 }],
        });
      },
    });
    expect(await store.schema()).toEqual({
      attributeNames: ['db.system.name', 'span.db.system.name'],
      eventNames: ['app.query.plan'],
      spanNames: ['db.query'],
    });
  });

  test('Local Explorer discovers SQL endpoint and maps tabular rows', async () => {
    const requests: { url: string; body?: string }[] = [];
    const store = new LocalExplorerTraceStore(
      'http://127.0.0.1:8787',
      async (input, init) => {
        requests.push({
          url: input,
          ...(typeof init?.body === 'string' ? { body: init.body } : {}),
        });
        if (init === undefined) {
          return Response.json({
            paths: {
              '/local/observability/query': {
                post: {
                  requestBody: {
                    content: {
                      'application/json': {
                        schema: {
                          properties: {
                            query: {
                              example: 'SELECT * FROM otel_spans LIMIT 25',
                              type: 'string',
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          });
        }
        return Response.json({
          result: {
            columns: [
              'trace_id',
              'span_id',
              'name',
              'start_time_ms',
              'duration_ms',
              'status',
            ],
            rows: [
              [
                TRACE_ID,
                '4444444444444444',
                'worker.fetch',
                1_790_078_400_000,
                8,
                'ok',
              ],
            ],
          },
        });
      }
    );
    const found = await store.recent({
      startMs: 1_790_078_399_000,
      endMs: 1_790_078_401_000,
    });
    expect(found[0]?.traceId).toBe(TRACE_ID);
    expect(requests[0]?.url).toEndWith('/cdn-cgi/local/explorer/api');
    expect(requests[1]?.url).toEndWith(
      '/cdn-cgi/local/explorer/api/local/observability/query'
    );
    const queryBody = JSON.parse(requests[1]?.body ?? '{}') as {
      readonly query?: string;
    };
    expect(queryBody.query).toContain('"otel_spans"');
    expect(queryBody.query).not.toContain('FROM spans');
  });
});
