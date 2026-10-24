import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { createNoopLogger } from '@pkgs/logger-shared-ts/logger';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import { createOwnerRuntime } from '@pkgs/sql-client-sqlite-web-client-ts/owner-runtime';

// regression: sqlite-owner-reopens-after-page-unload
test.each(['release', 'close'] as const)(
  '%s during a locked-open retry cannot create a new owner afterwards',
  async (end) => {
    const db = SqlClientImplMockingbirdSqlite.open({ seed: 1 });
    const time = createHarnessClock();
    const waiting = Promise.withResolvers<void>();
    let opens = 0;
    const runtime = createOwnerRuntime({
      dbName: 'user_740c685e6cc0',
      timers: time.timers,
      logger: { ...createNoopLogger(), warn: () => waiting.resolve() },
      createOwner: () => ({
        open: () =>
          ++opens === 1
            ? Promise.reject(
                new Error(
                  'InvalidStateError: The object is in an invalid state.'
                )
              )
            : Promise.resolve(db),
        close: () => Promise.resolve(),
        release: () => undefined,
        resetStore: () =>
          Promise.reject(new Error('No recovery may delete this device')),
      }),
    });
    const pending = runtime.open().catch(() => undefined);
    try {
      await waiting.promise;
      await runtime[end]();
      time.clock.advance(250);
      await pending;
      expect(opens).toBe(1);
      expect(time.clock.pendingOneShotCount()).toBe(0);
      expect(() => runtime.getClient()).toThrow('not open');
    } finally {
      runtime.release();
      await db.disconnect();
    }
  }
);
