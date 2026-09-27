/**
 * The selection window the feed picks from follows the player's synced
 * rating deviation: widest for a new player, narrower once rated attempts
 * have settled the rating. The window function itself is covered in
 * `tests/puzzle-session/next-puzzle-selection.test.ts`; this pins the wiring.
 */

import { describe, expect, test } from 'bun:test';
import { PUZZLE_RATING_DEFAULT_RD } from '@libs/chess/public/chess-puzzle-rating';
import {
  PUZZLE_WINDOW_HALF_MAX,
  PUZZLE_WINDOW_HALF_MIN,
  puzzleSelectionHalfWindow,
} from '@libs/chess/public/puzzle-session';
import {
  openPuzzleFromSpace,
  playUntilSolved,
  pressPuzzleNext,
  skipPuzzle,
} from '@libs/chess/sim/chess-actions';
import { ingestChessPuzzleCsv } from '@libs/chess/sim/chess-puzzle-data';
import { readPuzzleSelectionWindow } from '@libs/chess/sim/chess-puzzle-ui';
import {
  readServerPuzzleProfile,
  readServerRatingEvents,
} from '@libs/chess/sim/chess-rating-data';
import { accountIdOf, returnToTabs, signInWithGoogle } from '@libs/sim-harness';
import { createSpace } from '@libs/spaces/sim/space-actions';
import { RATING_CSV } from '../steps/puzzle-fixtures';
import { openSim } from './support/open-chess-sim';

const ATTEMPTS = 4;

describe('the selection window follows the synced rating deviation', () => {
  test('widest for a new player, narrower after rated attempts', async () => {
    await using s = await openSim('puzzle-selection-window');
    await s.apply(ingestChessPuzzleCsv, RATING_CSV);
    await s.apply(signInWithGoogle, 'alice');
    await s.apply(returnToTabs, 'alice');
    await s.apply(createSpace, 'alice');
    await s.apply(openPuzzleFromSpace, 'alice');
    const owner = await s.read(accountIdOf, 'alice');
    if (owner === null) throw new Error('alice is not signed in');

    expect(await s.read(readPuzzleSelectionWindow, 'alice')).toBe(
      PUZZLE_WINDOW_HALF_MAX
    );
    expect(puzzleSelectionHalfWindow(PUZZLE_RATING_DEFAULT_RD)).toBe(
      PUZZLE_WINDOW_HALF_MAX
    );

    // Solve, then skip: the rating stays near the pool while it settles.
    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
      await s.apply(attempt % 2 === 0 ? playUntilSolved : skipPuzzle, 'alice');
      await s.apply(pressPuzzleNext, 'alice');
    }
    await s.until(
      async (surf) =>
        (await readServerRatingEvents(surf, owner)).length === ATTEMPTS,
      { maxMs: 30_000 }
    );
    const profile = await s.read(readServerPuzzleProfile, owner);
    if (profile === null) throw new Error('no rating after rated attempts');
    expect(profile.rating_deviation).toBeLessThan(PUZZLE_RATING_DEFAULT_RD);

    const expected = puzzleSelectionHalfWindow(profile.rating_deviation);
    await s.until(
      async (surf) =>
        (await readPuzzleSelectionWindow(surf, 'alice')) === expected,
      { maxMs: 30_000 }
    );
    expect(expected).toBeLessThan(PUZZLE_WINDOW_HALF_MAX);
    expect(expected).toBeGreaterThanOrEqual(PUZZLE_WINDOW_HALF_MIN);
  });
});
