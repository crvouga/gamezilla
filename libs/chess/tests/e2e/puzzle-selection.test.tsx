// goal:chess-puzzles:9
/**
 * §9 puzzle selection, driven through the real feed.
 *
 * Fixture: `fixtures/chess-puzzles-selection.sim.csv` — four good puzzles on
 * the 1500 seed rating, five that fail the §9 quality bars at the same
 * rating, and three good ones at 1800–1900 (synced, but outside the ±window).
 * The three puzzles every sim seeds (`fixtures/chess-puzzles.sim.csv`, ~1200)
 * sit outside the window too, so the pool is small enough to exhaust.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
import {
  ingestChessPuzzleCsv,
  readLocalPuzzles,
} from '@libs/chess/sim/chess-puzzle-data';
import {
  isPuzzleAttemptRated,
  readActivePuzzleId,
  readPuzzlePickSource,
  readPuzzleSelectionWindow,
} from '@libs/chess/sim/chess-puzzle-ui';
import {
  readServerPuzzleProfile,
  readServerRatingEvents,
} from '@libs/chess/sim/chess-rating-data';
import {
  SIM_CHESS_FIXTURES_DIR,
  SIM_CHESS_PUZZLE_IDS,
} from '@libs/chess/sim/sim-chess-puzzles';
import { accountIdOf, returnToTabs, signInWithGoogle } from '@libs/sim-harness';
import { createSpace } from '@libs/spaces/sim/space-actions';
import type { OpenSim } from './support/open-chess-sim';
import { openSim } from './support/open-chess-sim';

const SELECTION_CSV = readFileSync(
  join(SIM_CHESS_FIXTURES_DIR, 'chess-puzzles-selection.sim.csv'),
  'utf8'
);

const WAIT_MS = 30_000;

/** In-window, above both §9 quality bars. */
const GOOD_IN_WINDOW: readonly string[] = ['008aL', '008cl', '008rw', '009bn'];
/** Below the popularity bar or the play-count bar — never servable. */
const LOW_QUALITY: readonly string[] = [
  '00A8H',
  '00A9Q',
  '00AEM',
  '00AfZ',
  '00BNd',
];
/** Good, synced, but outside the ±window around 1500. */
const OUT_OF_WINDOW: readonly string[] = ['00Bot', '00C8e', '00CYP'];

const ALL_SERVABLE: readonly string[] = [
  ...GOOD_IN_WINDOW,
  ...OUT_OF_WINDOW,
  ...SIM_CHESS_PUZZLE_IDS,
];

function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`expected ${what}`);
  }
  return value;
}

/**
 * The pool arrives one rating band at a time, so the very first puzzle is
 * placed from a partial catalog. Wait until the whole fixture is local
 * before judging what selection chose.
 */
async function enterSelectionFeed(s: OpenSim): Promise<void> {
  await s.apply(ingestChessPuzzleCsv, SELECTION_CSV);
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(returnToTabs, 'alice');
  await s.apply(createSpace, 'alice');
  await s.apply(openPuzzleFromSpace, 'alice');
  await s.until(
    async (surf) => {
      const local = new Set(
        (await readLocalPuzzles(surf, 'alice')).map((row) => row.id)
      );
      return ALL_SERVABLE.every((id) => local.has(id));
    },
    { maxMs: WAIT_MS, stepMs: 100 }
  );
}

/** Finish the puzzle on the board and move on, whatever its state. */
async function attemptAndAdvance(s: OpenSim, solve: boolean): Promise<void> {
  if (solve) {
    await s.apply(playUntilSolved, 'alice');
  } else {
    // Abandon scores zero; wrong moves receive half credit under the goal.
    await s.apply(skipPuzzle, 'alice');
  }
  await s.apply(pressPuzzleNext, 'alice');
}

/**
 * Play the whole unseen pool, asserting the §9 invariants at every step, and
 * return the ids in the order they were served.
 */
async function playWholePool(s: OpenSim): Promise<string[]> {
  const served: string[] = [];
  for (let i = 0; i < ALL_SERVABLE.length; i += 1) {
    const id = required(
      await s.read(readActivePuzzleId, 'alice'),
      'active puzzle'
    );
    // Never a repeat while the pool still holds something unseen, never a
    // low-quality puzzle, and every such attempt is rated.
    expect(served).not.toContain(id);
    expect(LOW_QUALITY).not.toContain(id);
    expect(await s.read(isPuzzleAttemptRated, 'alice')).toBe(true);
    served.push(id);
    await attemptAndAdvance(s, i % 2 === 0);
  }
  return served;
}

describe('§9 puzzle selection', () => {
  test('no repeat while unseen puzzles remain, and low-quality is never served', async () => {
    await using s = await openSim('chess-puzzle-selection-unseen');
    await enterSelectionFeed(s);

    const served = await playWholePool(s);
    expect(new Set(served).size).toBe(ALL_SERVABLE.length);
    // Everything inside the ±window is served before the good puzzles that
    // sit outside it (the first pick lands while the pool is still arriving,
    // so it comes from whatever had synced).
    const lastInWindow = Math.max(
      ...GOOD_IN_WINDOW.map((id) => served.indexOf(id))
    );
    const firstOutOfWindow = Math.min(
      ...OUT_OF_WINDOW.map((id) => served.indexOf(id))
    );
    expect(lastInWindow).toBeLessThan(firstOutOfWindow);
  });

  test('the window widens with RD and narrows as the rating settles', async () => {
    await using s = await openSim('chess-puzzle-selection-window');
    await enterSelectionFeed(s);
    const ownerId = required(await s.read(accountIdOf, 'alice'), 'account');

    // A brand new player has the maximum deviation: the widest window.
    expect(await s.read(readPuzzleSelectionWindow, 'alice')).toBe(
      puzzleSelectionHalfWindow(PUZZLE_RATING_DEFAULT_RD)
    );
    expect(await s.read(readPuzzleSelectionWindow, 'alice')).toBe(
      PUZZLE_WINDOW_HALF_MAX
    );

    for (let i = 0; i < 4; i += 1) {
      await attemptAndAdvance(s, i % 2 === 0);
    }
    await s.until(
      async (surf) =>
        (await readServerRatingEvents(surf, ownerId)).length === 4,
      { maxMs: WAIT_MS, stepMs: 100 }
    );
    const profile = required(
      await s.read(readServerPuzzleProfile, ownerId),
      'server profile'
    );
    expect(profile.rating_deviation).toBeLessThan(PUZZLE_RATING_DEFAULT_RD);

    await s.until(
      async (surf) =>
        (await readPuzzleSelectionWindow(surf, 'alice')) ===
        puzzleSelectionHalfWindow(profile.rating_deviation),
      { maxMs: WAIT_MS, stepMs: 100 }
    );
    const narrowed = required(
      await s.read(readPuzzleSelectionWindow, 'alice'),
      'selection window'
    );
    expect(narrowed).toBeLessThan(PUZZLE_WINDOW_HALF_MAX);
    expect(narrowed).toBeGreaterThanOrEqual(PUZZLE_WINDOW_HALF_MIN);
  });

  test('pool exhaustion serves the oldest attempt first, unrated', async () => {
    await using s = await openSim('chess-puzzle-selection-exhaust');
    await enterSelectionFeed(s);
    const ownerId = required(await s.read(accountIdOf, 'alice'), 'account');

    const played = await playWholePool(s);
    await s.until(
      async (surf) =>
        (await readServerRatingEvents(surf, ownerId)).length ===
        ALL_SERVABLE.length,
      { maxMs: WAIT_MS, stepMs: 100 }
    );
    const beforeRepeat = required(
      await s.read(readServerPuzzleProfile, ownerId),
      'server profile'
    );

    // Everything is played: the feed comes round to the oldest attempt.
    await s.until(
      async (surf) =>
        (await readPuzzlePickSource(surf, 'alice')) === 'exhausted',
      { maxMs: WAIT_MS, stepMs: 100 }
    );
    expect(await s.read(readActivePuzzleId, 'alice')).toBe(
      required(played[0], 'first played puzzle')
    );
    expect(await s.read(isPuzzleAttemptRated, 'alice')).toBe(false);

    await s.apply(playUntilSolved, 'alice');
    const events = await s.read(readServerRatingEvents, ownerId);
    expect(events.length).toBe(ALL_SERVABLE.length);
    const afterRepeat = required(
      await s.read(readServerPuzzleProfile, ownerId),
      'server profile'
    );
    expect(afterRepeat.rating).toBe(beforeRepeat.rating);
    expect(afterRepeat.rating_deviation).toBe(beforeRepeat.rating_deviation);
  });
});
