import { expect, test } from 'bun:test';
import { runHttpInvocation } from '@pkgs/http-client-shared/run-http-invocation';
import { createScopedHttpClient } from '@pkgs/http-client-shared/scoped-http-client';

function http() {
  return createScopedHttpClient({
    fetch: async () => Response.json({ ok: true }),
  });
}

test('waitUntil response leaks fail the local invocation instead of being swallowed', async () => {
  // regression: worker-http-response-body-leak
  const client = http();
  await expect(
    runHttpInvocation(client, async (waitUntil) => {
      waitUntil(client.fetch('https://collector.example/v1/traces'));
      return new Response(null, { status: 204 });
    })
  ).rejects.toThrow('HTTP response body leak');
});

test('waitUntil errors reject the invocation even when its response was HTTP 200', async () => {
  const client = http();
  await expect(
    runHttpInvocation(client, async (waitUntil) => {
      waitUntil(Promise.reject(new Error('collector failed')));
      return new Response('ok');
    })
  ).rejects.toThrow('collector failed');
});

test('background consumption completes before the ownership check', async () => {
  const client = http();
  let consumed = false;
  const response = await runHttpInvocation(client, async (waitUntil) => {
    waitUntil(
      client.fetch('https://collector.example/v1/traces').then(async (ack) => {
        await ack.json();
        consumed = true;
        waitUntil(
          client
            .fetch('https://collector.example/v1/logs')
            .then((log) => log.body?.cancel())
        );
      })
    );
    return new Response(null, { status: 204 });
  });
  expect(response.status).toBe(204);
  expect(consumed).toBe(true);
});
