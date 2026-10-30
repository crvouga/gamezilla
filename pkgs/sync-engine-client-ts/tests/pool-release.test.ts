import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { createSyncEnginePool } from '@pkgs/sync-engine-client-ts/sync-engine-pool';
import type { SyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-port';
import fc from 'fast-check';

function engine(): SyncEngine {
  return {
    disconnect: async () => undefined,
    db: { disconnect: async () => undefined },
  } as unknown as SyncEngine;
}

// regression: sync-pool-starts-released-queued-factory
test.each([false, true])(
  'release invalidates queued factories across shared handles=%s',
  async (shared) => {
    const globalKey = '__sync_pool_release_regression__';
    const pool = createSyncEnginePool(shared ? { globalKey } : {});
    const releaser = shared ? createSyncEnginePool({ globalKey }) : pool;
    const abandoned = Promise.withResolvers<SyncEngine>();
    const calls: string[] = [];
    const stale = pool
      .getOrCreate('guest', () => {
        calls.push('guest');
        return abandoned.promise;
      })
      .catch((error: Error) => error.message);
    await releaser.releaseAll();
    const replacement = pool.getOrCreate('account', async () => {
      calls.push('account');
      return engine();
    });
    try {
      for (let turn = 0; turn < 50; turn++) await Promise.resolve();
      expect(calls).toEqual(['account']);
      await replacement;
      expect(await stale).toBe(
        'sync-engine-pool: getOrCreate aborted after releaseAll'
      );
    } finally {
      abandoned.resolve(engine());
      await Promise.allSettled([stale, replacement]);
      await releaser.releaseAll();
      if (shared) Reflect.deleteProperty(globalThis, globalKey);
    }
  }
);

// regression: sync-pool-abandoned-engine-closes-before-drain
test('a late abandoned engine drains and closes before its replacement can open', async () => {
  const pool = createSyncEnginePool();
  const started = Promise.withResolvers<void>();
  const created = Promise.withResolvers<SyncEngine>();
  const drained = Promise.withResolvers<void>();
  const closed = Promise.withResolvers<void>();
  const events: string[] = [];
  const stale = pool
    .getOrCreate('guest', () => {
      started.resolve();
      return created.promise;
    })
    .catch((error: Error) => error.message);
  await started.promise;
  await pool.releaseAll();
  const next = pool.getOrCreate('account', async () => {
    events.push('replacement');
    return engine();
  });
  created.resolve({
    disconnect: () => {
      events.push('drain');
      return drained.promise;
    },
    db: {
      disconnect: () => {
        events.push('close');
        return closed.promise;
      },
    },
  } as unknown as SyncEngine);
  try {
    for (let turn = 0; turn < 50; turn++) await Promise.resolve();
    expect(events).toEqual(['drain']);
    drained.resolve();
    for (let turn = 0; turn < 50; turn++) await Promise.resolve();
    expect(events).toEqual(['drain', 'close']);
    closed.resolve();
    await next;
    expect(events).toEqual(['drain', 'close', 'replacement']);
    expect(await stale).toBe(
      'sync-engine-pool: getOrCreate aborted after releaseAll'
    );
  } finally {
    drained.resolve();
    closed.resolve();
    await Promise.allSettled([stale, next]);
    await pool.releaseAll();
  }
});

test('generated request and release epochs only create the surviving queued identities', async () => {
  await assertProperty(
    'pool releases invalidate every older queued request across API handles',
    fc.asyncProperty(
      fc.boolean(),
      fc.array(
        fc.array(fc.constantFrom('request', 'release'), {
          minLength: 1,
          maxLength: 8,
        }),
        { minLength: 1, maxLength: 6 }
      ),
      async (shared, phases) => {
        const globalKey = '__sync_pool_epoch_property__';
        const pool = createSyncEnginePool(shared ? { globalKey } : {});
        const releaser = shared ? createSyncEnginePool({ globalKey }) : pool;
        let epoch = 0;
        let sequence = 0;
        try {
          for (const phase of phases) {
            const calls: string[] = [];
            const requests: Array<{ name: string; epoch: number }> = [];
            const results: Array<Promise<string | null>> = [];
            const releases: Array<Promise<void>> = [];
            for (const command of phase) {
              if (command === 'release') {
                epoch++;
                releases.push(releaser.releaseAll());
              } else {
                const name = `identity-${sequence++}`;
                requests.push({ name, epoch });
                results.push(
                  pool
                    .getOrCreate(name, async () => {
                      calls.push(name);
                      return engine();
                    })
                    .then(
                      () => name,
                      () => null
                    )
                );
              }
            }
            const actual = await Promise.all(results);
            await Promise.all(releases);
            const expected = requests.filter(
              (request) => request.epoch === epoch
            );
            expect(calls).toEqual(expected.map((request) => request.name));
            expect(actual).toEqual(
              requests.map((request) =>
                request.epoch === epoch ? request.name : null
              )
            );
          }
        } finally {
          await pool.releaseAll();
          if (shared) Reflect.deleteProperty(globalThis, globalKey);
        }
      }
    )
  );
});

async function microtasks(turns: number): Promise<void> {
  for (let turn = 0; turn < turns; turn++) await Promise.resolve();
}

async function checkActiveRelease(input: {
  shared: boolean;
  drainTurns: number;
  closeTurns: number;
  rejectClose: boolean;
}): Promise<void> {
  const globalKey = '__sync_pool_active_release_property__';
  const pool = createSyncEnginePool(input.shared ? { globalKey } : {});
  const releaser = input.shared ? createSyncEnginePool({ globalKey }) : pool;
  const drained = Promise.withResolvers<void>();
  const closed = Promise.withResolvers<void>();
  const closeStarted = Promise.withResolvers<void>();
  const failure = new Error('old database close failed');
  const events: string[] = [];
  await pool.getOrCreate(
    'A',
    async () =>
      ({
        disconnect: () => {
          events.push('drain A');
          return drained.promise;
        },
        db: {
          disconnect: () => {
            events.push('close A');
            closeStarted.resolve();
            return closed.promise;
          },
        },
      }) as unknown as SyncEngine
  );
  const released = releaser.releaseAll().catch((error: unknown) => error);
  const next = pool.getOrCreate('B', async () => {
    events.push('open B');
    return engine();
  });
  try {
    await microtasks(50 + input.drainTurns);
    expect(events).toEqual(['drain A']);
    drained.resolve();
    await closeStarted.promise;
    await microtasks(50 + input.closeTurns);
    expect(events).toEqual(['drain A', 'close A']);
    if (input.rejectClose) closed.reject(failure);
    else closed.resolve();
    expect(await released).toBe(input.rejectClose ? failure : undefined);
    await next;
    expect(events).toEqual(['drain A', 'close A', 'open B']);
  } finally {
    drained.resolve();
    closed.resolve();
    await Promise.allSettled([released, next]);
    await pool.releaseAll();
    if (input.shared) Reflect.deleteProperty(globalThis, globalKey);
  }
}

// regression: sync-pool-release-does-not-fence-next-open
test('an unawaited release drains and closes the active database before the next identity opens', async () => {
  await checkActiveRelease({
    shared: false,
    drainTurns: 0,
    closeTurns: 0,
    rejectClose: false,
  });
});

test('generated active releases fence replacements through delayed cleanup and preserve close errors', async () => {
  await assertProperty(
    'unawaited active pool cleanup fences the next open through either API handle',
    fc.asyncProperty(
      fc.record({
        shared: fc.boolean(),
        drainTurns: fc.integer({ min: 0, max: 30 }),
        closeTurns: fc.integer({ min: 0, max: 30 }),
        rejectClose: fc.boolean(),
      }),
      checkActiveRelease
    )
  );
});

// regression: sync-pool-release-does-not-fence-next-open
test('a failed release still fences an earlier identity switch until its database closes', async () => {
  const pool = createSyncEnginePool();
  const drainStarted = Promise.withResolvers<void>();
  const drained = Promise.withResolvers<void>();
  const closed = Promise.withResolvers<void>();
  const closeStarted = Promise.withResolvers<void>();
  const failure = new Error('release cleanup failed');
  let disconnects = 0;
  await pool.getOrCreate(
    'A',
    async () =>
      ({
        disconnect: () => {
          disconnects++;
          if (disconnects > 1) return Promise.reject(failure);
          drainStarted.resolve();
          return drained.promise;
        },
        db: {
          disconnect: () => {
            closeStarted.resolve();
            return closed.promise;
          },
        },
      }) as unknown as SyncEngine
  );
  const oldSwitch = pool
    .getOrCreate('B', async () => engine())
    .catch((error: Error) => error.message);
  await drainStarted.promise;
  const released = pool.releaseAll().catch((error: unknown) => error);
  let opened = false;
  const next = pool.getOrCreate('C', async () => {
    opened = true;
    return engine();
  });
  try {
    expect(await released).toBe(failure);
    await microtasks(100);
    expect(opened).toBe(false);
    drained.resolve();
    await closeStarted.promise;
    await microtasks(100);
    expect(opened).toBe(false);
    closed.resolve();
    await next;
    expect(opened).toBe(true);
    expect(await oldSwitch).toBe(
      'sync-engine-pool: getOrCreate aborted after releaseAll'
    );
  } finally {
    drained.resolve();
    closed.resolve();
    await Promise.allSettled([released, oldSwitch, next]);
    await pool.releaseAll();
  }
});
