import { expect, test } from 'bun:test';
import { searchRating } from '@libs/game-matchmaking-shared-ts/synthetic-search-rating';
import { openConformanceDb } from '@libs/permissions-shared-ts/world';
import { PROFILE_TABLES } from '@libs/profile-shared-ts/tables';
import {
  matchmakingOwners,
  matchmakingWaiting,
} from '@pkgs/matchmaking-sql-shared-ts/tables';
import sql from '@pkgs/sql-root-shared-ts/sql';

async function waitingWorld() {
  const db = await openConformanceDb([
    ...PROFILE_TABLES,
    matchmakingOwners,
    matchmakingWaiting,
  ]);
  await db.run(
    sql`INSERT INTO profile (id, account_kind) VALUES ('cedar', 'synthetic'), ('maple', 'synthetic'), ('bob', NULL)`
  );
  const wait = async (owner: string, rating: number, joined: number) => {
    await db.run(
      sql`INSERT INTO matchmaking_owners (id, current_id, available) VALUES (${owner}, ${`w-${owner}`}, ${true})`
    );
    await db.run(sql`INSERT INTO matchmaking_waiting (id, owner_id, joined_at, data, partition_signature)
      VALUES (${`w-${owner}`}, ${owner}, ${joined}, ${JSON.stringify({ 'player/rating': rating })}, 'pool')`);
  };
  return { db, wait };
}

test('a Synthetic User searches at the level of the person waiting longest in its pool', async () => {
  const { db, wait } = await waitingWorld();
  await wait('maple', 1900, 1);
  await wait('bob', 1180, 2);
  expect(
    await searchRating(db, {
      ownerId: 'cedar',
      ownRating: 1675,
      poolSignature: 'pool',
    })
  ).toBe(1180);
  // Nobody waits in another pool: its own rating.
  expect(
    await searchRating(db, {
      ownerId: 'cedar',
      ownRating: 1675,
      poolSignature: 'other',
    })
  ).toBe(1675);
});

test('a person always searches at their own rating', async () => {
  const { db, wait } = await waitingWorld();
  await wait('cedar', 1900, 1);
  expect(
    await searchRating(db, {
      ownerId: 'bob',
      ownRating: 1325,
      poolSignature: 'pool',
    })
  ).toBe(1325);
});
