import { expect, test } from 'bun:test';
import productServer from '@apps/server-ts/product-server';

const ctx = { waitUntil: () => {}, passThroughOnException: () => {} };

async function boot(protection: 'production') {
  const response = await productServer.fetch(
    new Request('https://api.example/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries: [] }),
    }),
    { DEPLOYMENT_PROTECTION: protection } as never,
    ctx as never
  );
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

// regression: misconfiguration-reason-public-in-production
// A standard environment fails the invocation on any 5xx (worker-http.ts), and
// the local stack reads the reason from its own server; only production
// answers the public, and it must not say what is misconfigured.
test('production answers a boot failure without naming its configuration', async () => {
  const production = await boot('production');
  expect(production.status).toBe(503);
  expect(production.body).toEqual({ error: 'api misconfigured' });
});
