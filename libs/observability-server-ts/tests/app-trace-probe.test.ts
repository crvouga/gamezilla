import { expect, test } from 'bun:test';
import {
  appTraceIsReadable,
  readDatabaseOpenMs,
  requestAppTrace,
  requestDatabaseTrace,
} from '@libs/observability-server-ts/app-trace-probe';
import { serviceName } from '@libs/product-identity-shared-ts/technical-names';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';

const probe = {
  traceId: '11111111111111111111111111111111',
  spanId: '2222222222222222',
};
const credentials = {
  probe,
  tempoUrl: 'https://tempo.example',
  tempoUser: 'read',
  tempoToken: 'read-token',
  nowMs: 1_700_000_000_000,
};

// regression: observability-health-only-checks-empty-batches
test('a working collector or an empty trace cannot pass the app trail check', async () => {
  const empty: HttpClient = {
    fetch: async () => Response.json({ resourceSpans: [] }),
  };
  expect(await appTraceIsReadable(empty, credentials)).toBe(false);
});

test('the app request and the readable server span use the same investigation id', async () => {
  const calls: string[] = [];
  const http: HttpClient = {
    fetch: async (input, init) => {
      calls.push(String(input));
      if (String(input).endsWith('/api/health')) {
        expect(new Headers(init?.headers).get('traceparent')).toBe(
          `00-${probe.traceId}-${probe.spanId}-01`
        );
        return Response.json({ status: 'ok' });
      }
      expect(String(input)).toEndWith(`/api/traces/${probe.traceId}`);
      expect(new Headers(init?.headers).get('authorization')).toStartWith(
        'Basic '
      );
      return Response.json({
        resourceSpans: [
          {
            resource: {
              attributes: [
                {
                  key: 'service.name',
                  value: { stringValue: serviceName('server') },
                },
              ],
            },
            scopeSpans: [
              {
                spans: [
                  {
                    traceId: probe.traceId,
                    spanId: '3333333333333333',
                    name: 'worker.fetch',
                    startTimeUnixNano: '1700000000000000000',
                    endTimeUnixNano: '1700000000001000000',
                    attributes: [
                      {
                        key: 'http.response.status_code',
                        value: { intValue: '200' },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });
    },
  };
  expect(await requestAppTrace(http, 'https://app.example', probe)).toBe(true);
  expect(await appTraceIsReadable(http, credentials)).toBe(true);
  expect(calls).toHaveLength(2);
});

function span(name: string, startMs: number, endMs: number) {
  return {
    traceId: probe.traceId,
    spanId: `${name.length}${String(startMs)}`.padEnd(16, '0'),
    name,
    startTimeUnixNano: String(BigInt(1_700_000_000_000 + startMs) * 1_000_000n),
    endTimeUnixNano: String(BigInt(1_700_000_000_000 + endMs) * 1_000_000n),
    attributes: [],
  };
}

const traceWith = (spans: ReturnType<typeof span>[]) =>
  Response.json({
    resourceSpans: [
      {
        resource: {
          attributes: [
            {
              key: 'service.name',
              value: { stringValue: serviceName('server') },
            },
          ],
        },
        scopeSpans: [{ spans }],
      },
    ],
  });

test('the database request carries the investigation id to a route that opens the database', async () => {
  const seen = { url: '', traceparent: null as string | null };
  const http: HttpClient = {
    fetch: async (input, init) => {
      seen.url = String(input);
      seen.traceparent = new Headers(init?.headers).get('traceparent');
      return Response.json(null);
    },
  };
  expect(await requestDatabaseTrace(http, 'https://app.example/', probe)).toBe(
    true
  );
  expect(seen.url).toBe('https://app.example/api/auth/session');
  expect(seen.traceparent).toBe(`00-${probe.traceId}-${probe.spanId}-01`);
  const failing: HttpClient = {
    fetch: async () => new Response('down', { status: 503 }),
  };
  expect(
    await requestDatabaseTrace(failing, 'https://app.example', probe)
  ).toBe(false);
});

test("the time to reach the database is the connection span of the request's own trace", async () => {
  const http: HttpClient = {
    fetch: async () =>
      traceWith([
        span('worker.fetch', 0, 100),
        span('db.open', 0, 40),
        span('http.server.request', 0, 90),
      ]),
  };
  // Nanoseconds from the epoch do not survive floating point exactly.
  expect(Math.round((await readDatabaseOpenMs(http, credentials)) ?? -1)).toBe(
    40
  );
});

test('a trace without the connection span, or an unreadable one, has no time to reach the database', async () => {
  const noConnection: HttpClient = {
    fetch: async () => traceWith([span('worker.fetch', 0, 100)]),
  };
  expect(await readDatabaseOpenMs(noConnection, credentials)).toBeNull();
  const empty: HttpClient = {
    fetch: async () => Response.json({ resourceSpans: [] }),
  };
  expect(await readDatabaseOpenMs(empty, credentials)).toBeNull();
});
