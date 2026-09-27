/**
 * A guest's offline solve carries its complete rating state (rating,
 * deviation and volatility) through a restart, Google sign-in and a second
 * device, exactly once. The Gherkin says what a person sees; this pins the
 * stored rows each side holds.
 */

import { describe, expect, test } from 'bun:test';
import {
  openPuzzleFromSpace,
  playUntilSolved,
} from '@libs/chess/sim/chess-actions';
import { readPuzzlePlayerId } from '@libs/chess/sim/chess-puzzle-ledger-data';
import { readActivePuzzleId } from '@libs/chess/sim/chess-puzzle-ui';
import {
  readLocalPuzzleProfile,
  readLocalRatingEvents,
  readServerPuzzleProfile,
  readServerRatingEvents,
} from '@libs/chess/sim/chess-rating-data';
import {
  accountIdOf,
  partition,
  restartApp,
  restoreNetwork,
  signInWithGoogle,
  signInWithGoogleAsAccount,
  spawnActor,
} from '@libs/sim-harness';
import { createSpace } from '@libs/spaces/sim/space-actions';
import { openSim } from './support/open-chess-sim';

describe('guest puzzle progress carryover', () => {
  // regression: puzzle-profile-volatility-sync
  test('the full rating state of an offline guest solve reaches a second device once', async () => {
    await using s = await openSim('puzzle-guest-offline-carryover');
    await s.apply(createSpace, 'alice');
    await s.apply(openPuzzleFromSpace, 'alice');
    const puzzle = await s.read(readActivePuzzleId, 'alice');
    expect(puzzle).not.toBeNull();
    expect(await s.read(accountIdOf, 'alice')).toBeNull();

    await s.apply(partition, 'alice');
    await s.apply(playUntilSolved, 'alice');
    const owner = await s.read(readPuzzlePlayerId, 'alice');
    if (owner === null) throw new Error('missing guest puzzle owner');
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
      // Rating, deviation and volatility: the whole profile, not a part.
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
