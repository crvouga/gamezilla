import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type { MergeApplierDeps } from '@pkgs/sync-engine-client-ts/merge';
import { SubscriptionRuntime } from '@pkgs/sync-engine-client-ts/subscription-runtime';
import { createSyncEnginePool } from '@pkgs/sync-engine-client-ts/sync-engine-pool';
import type { SyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-port';
import type { QueryResponse } from '@pkgs/sync-engine-shared-ts/v2';
import fc from 'fast-check';

async function flushMicrotasks(): Promise<void> {
  for (let turn = 0; turn < 100; turn++) await Promise.resolve();
}

function fixture(write: () => Promise<void> = async () => undefined) {
  const requests: Array<
    ReturnType<typeof Promise.withResolvers<readonly QueryResponse[]>>
  > = [];
  const posted = Promise.withResolvers<void>();
  const errors: unknown[] = [];
  let writes = 0;
  let afterSweeps = 0;
  const db = {
    query: async () => [],
    run: async () => {
      writes++;
      await write();
      return { changes: 1 };
    },
    transaction: async (body: (tx: SqlClient) => Promise<unknown>) => body(db),
    disconnect: async () => undefined,
  } as unknown as SqlClient;
  const deps = {
    db,
    registry: {},
    clientId: 'device',
    bus: { subscribe: () => () => undefined, emit: () => undefined },
    env: { now: () => new Date(0) },
  } as unknown as MergeApplierDeps;
  const runtime = new SubscriptionRuntime({
    db,
    postQueries: () => {
      const response = Promise.withResolvers<readonly QueryResponse[]>();
      requests.push(response);
      posted.resolve();
      return response.promise;
    },
    getMergeDeps: () => deps,
    onError: (error) => errors.push(error),
    onSynced: () => undefined,
    timers: createHarnessClock().timers,
    coalesceMs: 0,
    reconcileIntervalMs: 0,
  });
  runtime.subscribe({ name: 'ownUser', params: {} });
  runtime.setAfterSweep(() => {
    afterSweeps++;
  });
  return {
    runtime,
    db,
    requests,
    posted,
    errors,
    writes: () => writes,
    afterSweeps: () => afterSweeps,
  };
}

const SNAPSHOT: readonly QueryResponse[] = [
  { status: 'ok', checkpoint: '1', hash: 'old', tables: {} },
];

// regression: sync-identity-switch-waits-for-old-query
test('switching identity releases a pending query without letting its late response write', async () => {
  const f = fixture();
  const pool = createSyncEnginePool();
  await pool.getOrCreate(
    'guest',
    async () =>
      ({
        db: f.db,
        disconnect: () => f.runtime.stopAndDrain(),
      }) as unknown as SyncEngine
  );
  f.runtime.start();
  await f.posted.promise;
  let created = false;
  const next = pool.getOrCreate('account', async () => {
    created = true;
    return {
      db: f.db,
      disconnect: async () => undefined,
    } as unknown as SyncEngine;
  });
  try {
    await flushMicrotasks();
    expect(created).toBe(true);
    await next;
    f.requests[0]!.resolve(SNAPSHOT);
    await flushMicrotasks();
    expect(f.writes()).toBe(0);
    expect(f.afterSweeps()).toBe(0);
    expect(f.errors).toEqual([]);
  } finally {
    f.requests[0]!.resolve(SNAPSHOT);
    await next;
    await pool.releaseAll();
  }
});

test.each(['resolve', 'reject'] as const)(
  'restarting cannot revive an abandoned query that later %ss',
  async (outcome) => {
    const f = fixture();
    f.runtime.start();
    await f.posted.promise;
    const stopped = f.runtime.stopAndDrain();
    f.runtime.start();
    try {
      await flushMicrotasks();
      expect(f.requests).toHaveLength(2);
      if (outcome === 'resolve') f.requests[0]!.resolve(SNAPSHOT);
      else f.requests[0]!.reject(new TypeError('abandoned network failed'));
      await stopped;
      await flushMicrotasks();
      expect(f.writes()).toBe(0);
      expect(f.afterSweeps()).toBe(0);
      expect(f.errors).toEqual([]);
    } finally {
      f.requests[0]!.resolve(SNAPSHOT);
      f.requests[1]?.resolve([{ status: 'not_modified' }]);
      await f.runtime.stopAndDrain();
      await stopped;
    }
  }
);

test('stopping still drains a SQL merge already writing before the database closes', async () => {
  const writeStarted = Promise.withResolvers<void>();
  const releaseWrite = Promise.withResolvers<void>();
  const f = fixture(() => {
    writeStarted.resolve();
    return releaseWrite.promise;
  });
  f.runtime.start();
  await f.posted.promise;
  f.requests[0]!.resolve(SNAPSHOT);
  await writeStarted.promise;
  let drained = false;
  const stopped = f.runtime.stopAndDrain().then(() => {
    drained = true;
  });
  try {
    await flushMicrotasks();
    expect(drained).toBe(false);
    releaseWrite.resolve();
    await stopped;
    expect(drained).toBe(true);
    expect(f.errors).toEqual([]);
  } finally {
    releaseWrite.resolve();
    await stopped;
  }
});

type PendingResponse = ReturnType<
  typeof Promise.withResolvers<readonly QueryResponse[]>
>;

function settleAbandoned(response: PendingResponse, reject: boolean): void {
  if (reject) response.reject(new TypeError('abandoned network failed'));
  else response.resolve(SNAPSHOT);
}

test('generated restarts make progress while obsolete responses settle in different orders', async () => {
  await assertProperty(
    'subscription restart fences every abandoned lifecycle and accepts the current snapshot',
    fc.asyncProperty(
      fc.array(
        fc.record({
          restartImmediately: fc.boolean(),
          settleCount: fc.integer({ min: 0, max: 3 }),
          settleIndex: fc.nat({ max: 8 }),
          reject: fc.boolean(),
        }),
        { minLength: 1, maxLength: 8 }
      ),
      async (schedule) => {
        const f = fixture();
        const abandoned: PendingResponse[] = [];
        f.runtime.start();
        await f.posted.promise;
        try {
          for (const step of schedule) {
            const count = f.requests.length;
            abandoned.push(f.requests[count - 1]!);
            let drained = false;
            const stopped = f.runtime.stopAndDrain().then(() => {
              drained = true;
            });
            if (step.restartImmediately) f.runtime.start();
            await flushMicrotasks();
            expect(drained).toBe(true);
            await stopped;
            if (!step.restartImmediately) f.runtime.start();
            await flushMicrotasks();
            expect(f.requests).toHaveLength(count + 1);
            for (let n = 0; n < step.settleCount && abandoned.length > 0; n++) {
              const [response] = abandoned.splice(
                step.settleIndex % abandoned.length,
                1
              );
              settleAbandoned(response!, step.reject);
            }
            await flushMicrotasks();
            expect(f.writes()).toBe(0);
            expect(f.afterSweeps()).toBe(0);
            expect(f.errors).toEqual([]);
          }
          for (const response of abandoned) settleAbandoned(response, false);
          await flushMicrotasks();
          expect(f.writes()).toBe(0);
          f.requests.at(-1)!.resolve(SNAPSHOT);
          await f.runtime.waitForScopes();
          await flushMicrotasks();
          expect(f.writes()).toBeGreaterThan(0);
          expect(f.afterSweeps()).toBe(1);
          expect(f.errors).toEqual([]);
        } finally {
          const stopped = f.runtime.stopAndDrain();
          for (const response of f.requests) response.resolve(SNAPSHOT);
          await stopped;
        }
      }
    )
  );
});
