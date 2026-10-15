import { expect, test } from 'bun:test';
import {
  appTraceIsReadable,
  requestAppTrace,
} from '@libs/observability-server/app-trace-probe';
import type { HttpClient } from '@pkgs/http-client-shared/types';

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
                  value: { stringValue: 'gamezilla-server' },
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
