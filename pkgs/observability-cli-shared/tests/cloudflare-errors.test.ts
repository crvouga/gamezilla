import { expect, test } from 'bun:test';
import { readCloudflareErrors } from '@pkgs/observability-cli-shared/cloudflare-errors';

// regression: platform-termination-missing-from-investigation
test('retained platform failures remain readable without an application trace', async () => {
  const result = await readCloudflareErrors({
    signal: new AbortController().signal,
    accountId: 'account',
    token: 'private-token',
    service: 'example-worker',
    range: { startMs: 1000, endMs: 2000 },
    http: {
      async fetch(input, init) {
        expect(String(input)).toEndWith(
          '/accounts/account/workers/observability/telemetry/query'
        );
        const query = JSON.parse(String(init?.body)) as {
          timeframe: unknown;
          parameters: {
            filters: { value?: string; filters?: { key: string }[] }[];
          };
        };
        expect(query.timeframe).toEqual({ from: 1000, to: 2000 });
        expect(query.parameters.filters[0]?.value).toBe('example-worker');
        expect(query.parameters.filters[1]?.filters?.[1]?.key).toBe(
          '$workers.outcome'
        );
        return Response.json({
          success: true,
          result: {
            events: {
              count: 1,
              events: [
                {
                  timestamp: 1500,
                  $metadata: {
                    id: 'native-event',
                    service: 'example-worker',
                    requestId: 'request',
                    error: 'Memory exceeded ?code=private-code',
                  },
                  $workers: { outcome: 'exceededMemory', eventType: 'alarm' },
                  source: { body: 'private request body' },
                },
              ],
            },
          },
        });
      },
    },
  });
  const text = JSON.stringify(result);
  expect(text).toContain('exceededMemory');
  expect(text).toContain('native-event');
  expect(text).not.toContain('private-code');
  expect(text).not.toContain('private request body');
});

test('denied platform access is reported rather than mistaken for no failures', async () => {
  await expect(
    readCloudflareErrors({
      signal: new AbortController().signal,
      accountId: 'account',
      token: 'token',
      service: 'example',
      range: { startMs: 0, endMs: 1 },
      http: {
        fetch: async () => new Response('private response', { status: 403 }),
      },
    })
  ).rejects.toThrow('HTTP 403');
});
