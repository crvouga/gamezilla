import { expect, test } from 'bun:test';
import type { PubSub } from '@pkgs/pubsub-root-shared/interface';
import type { Topic } from '@pkgs/pubsub-root-shared/topic';
import { publishPushMessages } from '@pkgs/sync-engine-server/notify-channels';

// regression: auth-push-outlives-http-invocation
test('request completion waits for every push transport to accept its message', async () => {
  const first = Promise.withResolvers<void>();
  const second = Promise.withResolvers<void>();
  const topics: Topic[] = [];
  const pubsub: PubSub = {
    publish: (topic) => {
      topics.push(topic);
      return topics.length === 1 ? first.promise : second.promise;
    },
    subscribe: () => () => {},
    status: () => 'connected',
    onStatus: () => () => {},
    close: () => {},
  };
  let completed = false;
  const pending = Promise.resolve(
    publishPushMessages({
      pubsub,
      pushSeqs: new Map<Topic, string>([
        ['user:alice', '1'],
        ['user:bob', '1'],
      ]),
    })
  ).then(() => {
    completed = true;
  });
  await Promise.resolve();
  expect(topics).toEqual(['user:alice', 'user:bob']);
  expect(completed).toBe(false);
  first.resolve();
  await Promise.resolve();
  expect(completed).toBe(false);
  second.resolve();
  await pending;
  expect(completed).toBe(true);
});
