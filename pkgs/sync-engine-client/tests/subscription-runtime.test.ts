import { describe, expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import type { QueryResponse } from '@pkgs/sync-engine-shared/v2';
import type { MergeApplierDeps } from '@pkgs/sync-engine-client/merge';
import { SubscriptionRuntime } from '@pkgs/sync-engine-client/subscription-runtime';

/** No scope has a stored hash, so every answer is taken as it comes. */
const emptyDb = {
  query: async () => [],
  run: async () => undefined,
} as unknown as SqlClient;

const mergeDeps = {
  bus: { subscribe: () => () => undefined },
  env: { now: () => new Date(0) },
} as unknown as MergeApplierDeps;

describe('SubscriptionRuntime.wakeAllAndDrain', () => {
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
