import { describe, expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type { MergeApplierDeps } from '@pkgs/sync-engine-client-ts/merge';
import { SubscriptionRuntime } from '@pkgs/sync-engine-client-ts/subscription-runtime';
import type { QueryResponse } from '@pkgs/sync-engine-shared-ts/v2';

/** No scope has a stored hash, so every answer is taken as it comes. */
const emptyDb = {
  query: async () => [],
  run: async () => undefined,
} as unknown as SqlClient;

const mergeDeps = {
  bus: { subscribe: () => () => undefined },
  env: { now: () => new Date(0) },
} as unknown as MergeApplierDeps;

// regression: subscription-reset-loses-first-sync-waiter
test('reset preserves a pending first-sync waiter', async () => {
  const runtime = new SubscriptionRuntime({
    db: emptyDb,
    postQueries: async (batch) =>
      batch.map(() => ({ status: 'not_modified' as const })),
    getMergeDeps: () => mergeDeps,
    onError: (error) => {
      throw error;
    },
    onSynced: () => undefined,
    timers: createHarnessClock().timers,
    coalesceMs: 0,
    reconcileIntervalMs: 0,
  });
  const subscription = runtime.subscribe({ name: 'rows', params: {} });
  let ready = false;
  void subscription.waitForFirstSync().then(() => {
    ready = true;
  });
  runtime.reset();
  expect(ready).toBe(false);
  runtime.start();
  try {
    await subscription.waitForFirstSync();
    await Promise.resolve();
    expect(ready).toBe(true);
  } finally {
    await runtime.stopAndDrain();
  }
});

describe('SubscriptionRuntime.wakeAllAndDrain', () => {
  // regression: sync-ack-discards-push-refetch
  test('an upload acknowledgement replaces an invalidated push refetch', async () => {
    const started = Promise.withResolvers<void>();
    const response = Promise.withResolvers<readonly QueryResponse[]>();
    let requests = 0;
    let confirmed = 0;
    const runtime = new SubscriptionRuntime({
      db: emptyDb,
      postQueries: async (batch) => {
        requests += 1;
        if (requests === 2) {
          started.resolve();
          return response.promise;
        }
        return batch.map(() => ({ status: 'not_modified' as const }));
      },
      getMergeDeps: () => mergeDeps,
      onError: (error) => {
        throw error;
      },
      onSynced: () => {
        confirmed += 1;
      },
      timers: createHarnessClock().timers,
      coalesceMs: 0,
      reconcileIntervalMs: 0,
    });
    runtime.start();
    const subscription = runtime.subscribe({ name: 'rows', params: {} });
    await subscription.waitForFirstSync();
    runtime.wakeScope(runtime.listActive()[0]!.scope);
    await started.promise;
    runtime.bumpGenerations();
    response.resolve([{ status: 'not_modified' }]);
    for (let turn = 0; turn < 100; turn += 1) await Promise.resolve();
    // An ack without an in-flight read must not poll already settled scopes.
    runtime.bumpGenerations();
    for (let turn = 0; turn < 100; turn += 1) await Promise.resolve();
    await runtime.stopAndDrain();
    expect(requests).toBe(3);
    expect(confirmed).toBe(2);
  });

  // regression: sync-refresh-starved-by-later-sweeps
  test('resolves once its sweep is done, while later wakes keep sweeping', async () => {
    let sweeps = 0;
    let rewake = (): void => undefined;
    let starved = (): void => undefined;
    const tenSweeps = new Promise<'starved'>((resolve) => {
      starved = () => resolve('starved');
    });
    const runtime = new SubscriptionRuntime({
      db: emptyDb,
      postQueries: async (requests) => {
        sweeps += 1;
        // Something else keeps waking the scope, sweep after sweep.
        if (sweeps < 10) rewake();
        else starved();
        return requests.map((): QueryResponse => ({ status: 'not_modified' }));
      },
      getMergeDeps: () => mergeDeps,
      onError: (error) => {
        throw error;
      },
      onSynced: () => undefined,
      timers: createHarnessClock().timers,
      reconcileIntervalMs: 0,
    });
    runtime.start();
    runtime.subscribe({ name: 'rows', params: {} });
    const [scope] = runtime.listActive();
    rewake = () => runtime.wakeScope(scope!.scope);

    const outcome = await Promise.race([
      runtime.wakeAllAndDrain().then(() => 'drained' as const),
      tenSweeps,
    ]);
    runtime.stop();

    expect(outcome).toBe('drained');
    expect(sweeps).toBeLessThan(10);
  });
});
