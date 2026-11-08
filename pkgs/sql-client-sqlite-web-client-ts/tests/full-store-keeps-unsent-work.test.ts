import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { createNoopLogger } from '@pkgs/logger-shared-ts/logger';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import { createOwnerRuntime } from '@pkgs/sql-client-sqlite-web-client-ts/owner-runtime';
import sql from '@pkgs/sql-root-shared-ts/sql';
import fc from 'fast-check';

/** What a store full of junk (or a device out of quota) reports on open. */
const FULL_STORE_ERRORS = [
  'SQLITE_FULL: database or disk is full',
  'SAH pool is full',
  'cannot create file',
  'Error: sqlite3_open_v2 (cannot create file)',
] as const;

/**
 * One device's database file holding a write that has not uploaded yet. The
 * store refuses `fullOpens` opens for lack of room, then has room again.
 */
async function deviceWithUnsentWrite(fullOpens: number, message: string) {
  const file = SqlClientImplMockingbirdSqlite.open({ seed: 1 });
  await file.connect();
  await file.run(sql`CREATE TABLE unsent (id TEXT PRIMARY KEY)`);
  await file.run(sql`INSERT INTO unsent (id) VALUES (${'note-1'})`);
  let refusals = fullOpens;
  let wipes = 0;
  const runtime = createOwnerRuntime({
    dbName: 'user_740c685e6cc0',
    timers: createHarnessClock().timers,
    logger: createNoopLogger(),
    createOwner: () => ({
      open: () => {
        if (refusals > 0) {
          refusals -= 1;
          return Promise.reject(new Error(message));
        }
        return Promise.resolve(file);
      },
      close: () => Promise.resolve(),
      release: () => undefined,
      resetStore: async () => {
        wipes += 1;
        await file.run(sql`DROP TABLE IF EXISTS unsent`);
      },
    }),
  });
  return {
    runtime,
    wipes: () => wipes,
    unsent: async () =>
      (
        await runtime
          .getClient()
          .query(sql<{ id: string }>`SELECT id FROM unsent ORDER BY id`)
      ).map((row) => row.id),
    dispose: async () => {
      runtime.release();
      await file.disconnect();
    },
  };
}

/** Opens until the store has room, failing each full attempt; returns failures. */
async function openUntilRoom(
  runtime: ReturnType<typeof createOwnerRuntime>,
  attempts: number
): Promise<readonly string[]> {
  const failures: string[] = [];
  for (let i = 0; i < attempts; i++) {
    try {
      await runtime.open();
      return failures;
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  return failures;
}

// regression: storage-full-open-erases-unsent-work
test('a full store at open keeps the unsent write instead of erasing the database', async () => {
  const device = await deviceWithUnsentWrite(
    1,
    'SQLITE_FULL: database or disk is full'
  );
  try {
    const failures = await openUntilRoom(device.runtime, 2);
    expect(failures).toEqual(['SQLITE_FULL: database or disk is full']);
    expect(device.wipes()).toBe(0);
    expect(await device.unsent()).toEqual(['note-1']);
  } finally {
    await device.dispose();
  }
});

test('however often and however the store reports being full, nothing unsent is erased', async () => {
  await assertProperty(
    'full store never erases unsent work',
    fc.asyncProperty(
      fc.integer({ min: 1, max: 4 }),
      fc.constantFrom(...FULL_STORE_ERRORS),
      async (fullOpens, message) => {
        const device = await deviceWithUnsentWrite(fullOpens, message);
        try {
          const failures = await openUntilRoom(device.runtime, fullOpens + 1);
          // Every full open fails to the host (which runs on a disposable
          // database meanwhile); none of them erases the file.
          expect(failures).toHaveLength(fullOpens);
          expect(device.wipes()).toBe(0);
          expect(await device.unsent()).toEqual(['note-1']);
        } finally {
          await device.dispose();
        }
      }
    )
  );
});
