import { expect, test } from 'bun:test';
import { runWorkerHttp } from '@apps/server/worker-http';
import { createScopedHttpClient } from '@pkgs/http-client-shared/scoped-http-client';

const ctx = { waitUntil: () => {}, passThroughOnException: () => {} };

test('standard Workers turn server error responses into invocation failures', async () => {
  const http = createScopedHttpClient({ fetch: async () => Response.json({}) });
  await expect(
    runWorkerHttp(
      http,
      { DEPLOYMENT_PROTECTION: 'standard' },
      ctx,
      async () => {
        return Response.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    )
  ).rejects.toThrow('Worker returned HTTP 500 in a standard environment');
});

test('standard Workers fail an unread response at the invocation boundary', async () => {
  // regression: worker-http-response-body-leak
  const http = createScopedHttpClient({ fetch: async () => Response.json({}) });
  await expect(
    runWorkerHttp(
      http,
      { DEPLOYMENT_PROTECTION: 'standard' },
      ctx,
      async () => {
        await http.fetch('https://collector.example/v1/traces');
        return Response.json({ ok: true });
      }
    )
  ).rejects.toThrow('HTTP response body leak');
});

test('standard Workers expose rejected background work despite foreground success', async () => {
  const http = createScopedHttpClient({ fetch: async () => Response.json({}) });
  await expect(
    runWorkerHttp(
      http,
      { DEPLOYMENT_PROTECTION: 'standard' },
      ctx,
      async (local) => {
        local.waitUntil(Promise.reject(new Error('export failed')));
        return Response.json({ ok: true });
      }
    )
  ).rejects.toThrow('export failed');
});

test('production keeps background work on the platform execution context', async () => {
  const http = createScopedHttpClient({ fetch: async () => Response.json({}) });
  const pending: Promise<unknown>[] = [];
  const response = await runWorkerHttp(
    http,
    { DEPLOYMENT_PROTECTION: 'production' },
    {
      ...ctx,
      waitUntil: (work) => {
        pending.push(work);
      },
    },
    async (platform) => {
      platform.waitUntil(Promise.resolve());
      return Response.json({ ok: true });
    }
  );
  expect(response.status).toBe(200);
  expect(pending).toHaveLength(1);
  await Promise.all(pending);
});
