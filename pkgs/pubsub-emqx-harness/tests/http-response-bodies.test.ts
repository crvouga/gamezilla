import { expect, test } from 'bun:test';
import { createScopedHttpClient } from '@pkgs/http-client-shared/scoped-http-client';
import type { HttpFetch } from '@pkgs/http-client-shared/types';
import { createEmqxHttpPubSub } from '@pkgs/pubsub-emqx-shared/create-emqx-http-pubsub';
import { createIotHttpPubSub } from '@pkgs/pubsub-root-shared/create-iot-http-pubsub';
import { PubSubPublishError } from '@pkgs/pubsub-root-shared/pubsub-publish-error';

const brokers = ['emqx', 'iot'] as const;

function publisher(broker: (typeof brokers)[number], fetchImpl: HttpFetch) {
  return broker === 'emqx'
    ? createEmqxHttpPubSub({
        apiBaseUrl: 'http://127.0.0.1:55009',
        apiKey: 'local-key',
        apiSecret: 'local-secret',
        fetchImpl,
      })
    : createIotHttpPubSub({
        endpoint: 'broker.iot.us-east-1.amazonaws.com',
        accessKeyId: 'fixture',
        secretAccessKey: 'fixture',
        region: 'us-east-1',
        now: () => 0,
        fetchImpl,
      });
}

test.each(brokers)(
  '%s publishing releases the acknowledgement before the request scope ends',
  async (broker) => {
    // regression: pubsub-publish-response-body-leak
    const http = createScopedHttpClient({
      fetch: async () => new Response('{}', { status: 200 }),
    });
    const pubsub = publisher(broker, http.fetch);
    await http.run(() => pubsub.publish('system:status', {}));
  }
);

test.each(brokers)('%s publishing awaits body cancellation', async (broker) => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    async cancel() {
      await Promise.resolve();
      cancelled = true;
    },
  });
  const pubsub = publisher(broker, async () => new Response(body));
  await pubsub.publish('user:actor1', {});
  expect(cancelled).toBe(true);
});

test.each(brokers)(
  '%s publishing accepts a bodyless response',
  async (broker) => {
    const http = createScopedHttpClient({
      fetch: async () => new Response(null, { status: 204 }),
    });
    const pubsub = publisher(broker, http.fetch);
    await http.run(() => pubsub.publish('user:actor1', {}));
  }
);

test.each(brokers)(
  '%s publishing releases refused responses',
  async (broker) => {
    const http = createScopedHttpClient({
      fetch: async () => new Response('publish refused', { status: 401 }),
    });
    const pubsub = publisher(broker, http.fetch);
    await http.run(async () => {
      await expect(pubsub.publish('user:actor1', {})).rejects.toBeInstanceOf(
        PubSubPublishError
      );
    });
  }
);
