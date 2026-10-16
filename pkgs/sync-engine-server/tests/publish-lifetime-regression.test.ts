import { expect, test } from 'bun:test';
import type { PubSub } from '@pkgs/pubsub-root-shared/interface';
import { publishPushMessages } from '@pkgs/sync-engine-server/notify-channels';

// regression: push-publish-outlives-request
// A slow accepted publish must finish before the caller releases its HTTP scope.
test('push publication retains request ownership until the publisher completes', async () => {
  let accept!: () => void;
  const accepted = new Promise<void>((resolve) => {
    accept = resolve;
  });
  const pubsub = { publish: async () => accepted } as unknown as PubSub;
  let released = false;
  const request = Promise.resolve(
    publishPushMessages({
      pubsub,
      pushSeqs: new Map([['user:peer', '6']]),
    })
  ).then(() => {
    released = true;
  });
  await Promise.resolve();
  expect(released).toBe(false);
  accept();
  await request;
  expect(released).toBe(true);
});
