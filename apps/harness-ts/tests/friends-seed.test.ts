import { expect, test } from 'bun:test';
import { LAST_LOCAL_ACCOUNT_ID_KEY } from '@libs/auth-shared-ts/auth-storage-keys';
import { SessionCapabilityStore } from '@libs/auth-shared-ts/session-capability';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { APP_SYSTEM } from '@libs/runtime-harness-ts/app-composition';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { seedFriends } from '../src/product-harness-friends-seed';

test('a fresh world starts with alice and bob signed in and friends', async () => {
  await using run = await APP_SYSTEM.run({ seed: 1, runtime: 'in-process' });
  let surface: ProductHarness | null = null;
  await run.apply(
    defineAction({
      name: 'friendsSeedTest.pin',
      report: false,
      act: (s: ProductHarness) => {
        surface = s;
      },
    })
  );
  const harness = (surface as unknown as ProductHarness).harness;

  expect(await seedFriends(harness, async () => undefined)).toEqual([
    'alice',
    'bob',
  ]);

  const accounts: string[] = [];
  for (const id of ['alice', 'bob']) {
    const device = (await harness.client(id)).secureStorage;
    expect(new SessionCapabilityStore(device).readToken()).not.toBeNull();
    accounts.push(String(device.getValue(LAST_LOCAL_ACCOUNT_ID_KEY)));
  }
  const db = harness.serverSql.sqlClient;
  const friendships = await db.query(
    sql<{
      user_low: string;
      user_high: string;
    }>`SELECT user_low, user_high FROM friends_friendships WHERE deleted_at IS NULL`
  );
  expect(
    friendships.map((row) => [row.user_low, row.user_high].sort())
  ).toEqual([[...accounts].sort()]);
  const names = await db.query(
    sql<{
      username: string;
    }>`SELECT username FROM profile ORDER BY username`
  );
  expect(names.map((row) => row.username)).toEqual(['alice', 'bob']);
});
