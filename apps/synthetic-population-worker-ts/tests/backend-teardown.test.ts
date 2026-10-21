import { expect, test } from 'bun:test';
import { workerWallPorts } from '@apps/synthetic-population-worker-ts/wall-io';
import { runtimeBackend } from './runtime-backend';
import { runtimePubSub } from './runtime-pubsub';

// regression: synthetic-backend-disposes-before-http
test('backend cleanup drains an admitted request before disposing its harness', async () => {
  const backend = await runtimeBackend(0);
  const body = new TransformStream<Uint8Array, Uint8Array>();
  const writer = body.writable.getWriter();
  const encode = new TextEncoder();
  const response = backend.wall
    .http(`${backend.origin}/api/mutations`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-sync-protocol': '3',
        'x-anon-id': backend.wall.createId(),
      },
      body: body.readable,
    })
    .then(
      (value) => value,
      (error: unknown) => error
    );
  try {
    await writer.write(encode.encode('{"mutations":'));
    const deadline = backend.wall.clock.now() + 5_000;
    while (backend.requests.length === 0 && backend.wall.clock.now() < deadline)
      await new Promise<void>((resolve) =>
        backend.wall.timers.setTimeout(resolve, 1)
      );
    expect(backend.requests.map((request) => request.path)).toContain(
      '/api/mutations'
    );
    const closing = backend.close();
    await writer.write(encode.encode('[]}'));
    await writer.close();
    const result = await response;
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBeLessThan(500);
    await closing;
  } finally {
    await writer.abort().catch(() => undefined);
    await backend.close();
  }
}, 30_000);

// regression: synthetic-backend-disposes-before-http
test('broker cleanup waits for an admitted invalidation to finish', async () => {
  const wall = workerWallPorts();
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const messaging = await runtimePubSub({
    ...wall,
    http: async (...args) => {
      started.resolve();
      await release.promise;
      return wall.http(...args);
    },
  });
  try {
    const publish = messaging.events.publish('test:topic', { accepted: true });
    await started.promise;
    const closing = messaging.close();
    release.resolve();
    await publish;
    await closing;
  } finally {
    release.resolve();
    await messaging.close();
  }
});
