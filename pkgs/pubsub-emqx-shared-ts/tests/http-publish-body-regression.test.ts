import { expect, test } from 'bun:test';
import { createScopedHttpClient } from '@pkgs/http-client-shared-ts/scoped-http-client';
import { createEmqxHttpPubSub } from '@pkgs/pubsub-emqx-shared-ts/create-emqx-http-pubsub';

// regression: emqx-successful-publish-body-leak
test('an accepted publish releases its JSON response before the request ends', async () => {
  const http = createScopedHttpClient({
    fetch: async () => Response.json({ id: 'accepted-message' }),
  });
  const pubsub = createEmqxHttpPubSub({
    apiBaseUrl: 'http://emqx:18083',
    apiKey: 'key',
    apiSecret: 'secret',
    http,
  });
  await expect(
    http.run(() => pubsub.publish('space:ready', { ready: true }))
  ).resolves.toBeUndefined();
  pubsub.close();
});
