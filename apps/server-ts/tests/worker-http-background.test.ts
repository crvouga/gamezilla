import { expect, test } from 'bun:test';
import { runWorkerHttp } from '@apps/server-ts/worker-http';
import { createScopedHttpClient } from '@pkgs/http-client-shared-ts/scoped-http-client';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

async function detachedResponse(
  status: number,
  failures: readonly boolean[]
): Promise<void> {
  const http = createScopedHttpClient({ fetch: async () => Response.json({}) });
  const gates = failures.map(() => Promise.withResolvers<void>());
  const pending: Promise<unknown>[] = [];
  let settled = false;
  let returned: Response | undefined;
  let rejected: unknown;
  let completions: PromiseSettledResult<unknown>[] = [];
  const reply = runWorkerHttp(
    http,
    { DEPLOYMENT_PROTECTION: 'standard' },
    {
      waitUntil: (work) => {
        pending.push(work);
      },
      passThroughOnException() {},
    },
    async (context) => {
      for (const [index, gate] of gates.entries()) {
        context.waitUntil(
          gate.promise.then(() => {
            if (failures[index]) throw new Error('background failed');
          })
        );
      }
      return Response.json({ status: 'ok' }, { status });
    }
  ).then(
    (response) => {
      settled = true;
      returned = response;
    },
    (error) => {
      settled = true;
      rejected = error;
    }
  );
  try {
    for (let job = 0; job < 20; job++) await Promise.resolve();
    expect(settled).toBe(true);
    if (status >= 500) expect(String(rejected)).toContain(`HTTP ${status}`);
    else expect(returned?.status).toBe(status);
  } finally {
    for (const gate of gates) gate.resolve();
    await reply;
    completions = await Promise.allSettled(pending);
  }
  expect(completions).toHaveLength(1);
  expect(completions[0]?.status).toBe(
    status >= 500 || failures.some(Boolean) ? 'rejected' : 'fulfilled'
  );
}

// regression: worker-background-work-blocks-responses
test('a health response returns while its background exporter remains unfinished', () =>
  detachedResponse(200, [false]));

test('foreground outcomes never wait for background work, whose failures remain observable', async () => {
  await assertProperty(
    'Worker foreground and background lifetimes',
    fc.asyncProperty(
      fc.constantFrom(200, 202, 409, 500, 503),
      fc.array(fc.boolean(), { minLength: 1, maxLength: 4 }),
      detachedResponse
    )
  );
});

test('an unread background response still fails platform completion after replying', async () => {
  const http = createScopedHttpClient({
    fetch: async () => Response.json({ ok: true }),
  });
  const gate = Promise.withResolvers<void>();
  const pending: Promise<unknown>[] = [];
  const reply = runWorkerHttp(
    http,
    { DEPLOYMENT_PROTECTION: 'standard' },
    {
      waitUntil: (work) => {
        pending.push(work);
      },
      passThroughOnException() {},
    },
    async (context) => {
      context.waitUntil(
        gate.promise.then(() =>
          http.fetch('https://collector.example/v1/traces')
        )
      );
      return Response.json({ status: 'ok' });
    }
  );
  gate.resolve();
  expect((await reply).status).toBe(200);
  expect(pending).toHaveLength(1);
  await expect(pending[0]).rejects.toThrow('HTTP response body leak');
});
