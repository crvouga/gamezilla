import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { PubSub } from '@pkgs/pubsub-root-shared-ts/interface';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { attachPush } from '@pkgs/sync-engine-client-ts/attach-push';
import type { MergeApplierDeps } from '@pkgs/sync-engine-client-ts/merge';
import { SubscriptionRuntime } from '@pkgs/sync-engine-client-ts/subscription-runtime';
import type { QueryRegistry } from '@pkgs/sync-engine-shared-ts/queries-types';

// regression: push-subscribes-to-other-peoples-user-topics
test('push subscribes only to the topics the person can be granted', async () => {
  const { timers } = createHarnessClock();
  const db = {
    query: async () => [],
    run: async () => undefined,
  } as unknown as SqlClient;
  const mergeDeps = {
    bus: { subscribe: () => () => undefined },
    env: { now: () => new Date(0) },
  } as unknown as MergeApplierDeps;
  const runtime = new SubscriptionRuntime({
    db,
    postQueries: async (batch) =>
      batch.map(() => ({ status: 'not_modified' as const })),
    getMergeDeps: () => mergeDeps,
    onError: () => undefined,
    onSynced: () => undefined,
    timers,
    coalesceMs: 0,
    reconcileIntervalMs: 0,
  });
  const subscribed: string[] = [];
  const pubsub: PubSub = {
    publish: async () => undefined,
    subscribe: (topic) => {
      subscribed.push(topic);
      return () => undefined;
    },
    status: () => 'connected',
    onStatus: () => () => undefined,
    close: () => undefined,
  };
  const queryRegistry = {
    rows: {
      entryChannel: () => ['user:reader', 'user:host', 'room:space'],
    },
  } as unknown as QueryRegistry;
  runtime.start();
  await runtime.subscribe({ name: 'rows', params: {} }).waitForFirstSync();
  const detach = attachPush({
    pubsub,
    runtime,
    queryRegistry,
    getChannelsCtx: () => ({ actorId: 'reader' }),
    remakePubSub: () => pubsub,
    canSubscribe: (topic) =>
      !topic.startsWith('user:') || topic === 'user:reader',
    db,
    timers,
    now: () => 0,
  });
  try {
    for (let turn = 0; turn < 100; turn += 1) await Promise.resolve();
    expect([...subscribed].sort()).toEqual(['room:space', 'user:reader']);
  } finally {
    detach();
    await runtime.stopAndDrain();
  }
});
