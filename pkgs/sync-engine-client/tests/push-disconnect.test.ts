import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import type { PubSub, PubSubStatus } from '@pkgs/pubsub-root-shared/interface';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import { attachPush } from '@pkgs/sync-engine-client/attach-push';
import type { MergeApplierDeps } from '@pkgs/sync-engine-client/merge';
import { SubscriptionRuntime } from '@pkgs/sync-engine-client/subscription-runtime';

// regression: sync-push-loss-hides-outage
test('push loss checks the server once, even when no mutation is pending', async () => {
  const { timers } = createHarnessClock();
  const db = {
    query: async () => [],
    run: async () => undefined,
  } as unknown as SqlClient;
  const mergeDeps = {
    bus: { subscribe: () => () => undefined },
    env: { now: () => new Date(0) },
  } as unknown as MergeApplierDeps;
  let requests = 0;
  let reachable = true;
  const errors: unknown[] = [];
  const unavailable = new TypeError('server unreachable');
  const runtime = new SubscriptionRuntime({
    db,
    postQueries: async (batch) => {
      requests += 1;
      if (!reachable) throw unavailable;
      return batch.map(() => ({ status: 'not_modified' as const }));
    },
    getMergeDeps: () => mergeDeps,
    onError: (error) => errors.push(error),
    onSynced: () => undefined,
    timers,
    coalesceMs: 0,
    reconcileIntervalMs: 0,
  });
  let notify: (status: PubSubStatus) => void = () => undefined;
  const pubsub: PubSub = {
    publish: async () => undefined,
    subscribe: () => () => undefined,
    status: () => 'connected',
    onStatus: (listener) => {
      notify = listener;
      return () => {
        notify = () => undefined;
      };
    },
    close: () => undefined,
  };
  runtime.start();
  await runtime.subscribe({ name: 'rows', params: {} }).waitForFirstSync();
  const detach = attachPush({
    pubsub,
    runtime,
    queryRegistry: {},
    getChannelsCtx: () => ({ actorId: 'reader' }),
    remakePubSub: () => pubsub,
    db,
    timers,
    now: () => 0,
  });
  try {
    reachable = false;
    notify('down');
    for (let turn = 0; turn < 100; turn += 1) await Promise.resolve();
    notify('down');
    for (let turn = 0; turn < 100; turn += 1) await Promise.resolve();
    expect(requests).toBe(2);
    expect(errors).toEqual([unavailable]);
    reachable = true;
    notify('connected');
    for (let turn = 0; turn < 100; turn += 1) await Promise.resolve();
    expect(requests).toBe(3);
  } finally {
    detach();
    await runtime.stopAndDrain();
  }
});
