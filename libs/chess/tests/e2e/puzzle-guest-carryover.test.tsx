// goal:works-offline:5
// goal:always-true:1
// goal:always-true:2
// goal:social:2
// goal:always-true:10
import { describe, expect, test } from 'bun:test';
import {
  openPuzzleFromSpace,
  playUntilSolved,
} from '@libs/chess/sim/chess-actions';
import { readActivePuzzleId } from '@libs/chess/sim/chess-puzzle-ui';
import {
  readLocalPuzzleProfile,
  readLocalRatingEvents,
  readServerPuzzleProfile,
  readServerRatingEvents,
} from '@libs/chess/sim/chess-rating-data';
import {
  accountIdOf,
  actorLocalSql,
  partition,
  restartApp,
  restoreNetwork,
  signInWithGoogle,
  signInWithGoogleAsAccount,
  spawnActor,
} from '@libs/sim-harness';
import { createSpace } from '@libs/spaces/sim/space-actions';
import { sql } from '@pkgs/sql';
import { openSim } from './support/open-chess-sim';

describe('guest puzzle progress carryover', () => {
  test('an offline guest solve survives Google sign-in and reaches a second device once', async () => {
    await using s = await openSim('puzzle-guest-offline-carryover');
    await s.apply(createSpace, 'alice');
    await s.apply(openPuzzleFromSpace, 'alice');
    const puzzle = await s.read(readActivePuzzleId, 'alice');
    expect(puzzle).not.toBeNull();
    expect(await s.read(accountIdOf, 'alice')).toBeNull();

    await s.apply(partition, 'alice');
    await s.apply(playUntilSolved, 'alice');
    const owner = await s.read(async (surf) => {
      const db = actorLocalSql(surf, 'alice');
      const rows = await db?.query(sql<{ owner_id: string }>`
        SELECT owner_id FROM chess_puzzle_profiles WHERE deleted_at IS NULL
      `);
      return rows?.[0]?.owner_id;
    });
    if (owner === undefined) throw new Error('missing guest puzzle profile');
    const profile = await s.read(readLocalPuzzleProfile, 'alice', owner);
    expect(profile).not.toBeNull();
    expect(await s.read(readLocalRatingEvents, 'alice', owner)).toHaveLength(1);
    expect(await s.read(readServerRatingEvents, owner)).toEqual([]);

    await s.apply(restartApp, 'alice');
    expect(await s.read(readLocalPuzzleProfile, 'alice', owner)).toEqual(
      profile
    );
    expect(await s.read(readLocalRatingEvents, 'alice', owner)).toHaveLength(1);

    await s.apply(restoreNetwork);
    await s.apply(signInWithGoogle, 'alice');
    expect(await s.read(accountIdOf, 'alice')).toBe(owner);
    await s.until(
      async (surf) => (await readServerRatingEvents(surf, owner)).length === 1,
      { maxMs: 30_000 }
    );
    expect(await s.read(readServerPuzzleProfile, owner)).toEqual(profile);

    await s.apply(spawnActor, 'bob');
    await s.apply(signInWithGoogleAsAccount, 'bob', 'alice');
    await s.until(
      async (surf) =>
        (await readLocalRatingEvents(surf, 'bob', owner)).length === 1,
      { maxMs: 30_000 }
    );
    for (const actor of ['alice', 'bob']) {
      expect(await s.read(readLocalPuzzleProfile, actor, owner)).toEqual(
        profile
      );
      const events = await s.read(readLocalRatingEvents, actor, owner);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        puzzle_id: puzzle,
        score_permille: 1000,
      });
    }
  });
});
