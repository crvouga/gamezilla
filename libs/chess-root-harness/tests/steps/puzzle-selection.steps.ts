/**
 * Choosing the next puzzle: a pool stocked with puzzles of known rating and
 * quality, which of them the feed serves, and what a second device serves.
 */

import { expect } from 'bun:test';
import { readServerPuzzles } from '@libs/chess-puzzle-harness/chess-puzzle-data';
import { readStatsElo } from '@libs/chess-puzzle-harness/chess-puzzle-ui';
import {
  GOOD_PUZZLE,
  retireEveryPuzzle,
} from '@libs/chess-puzzle-harness/puzzle-pool-stock';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { otherDevice } from '@libs/harness/platform';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { remember } from '@libs/harness/spec-world';
import { reopenSpaceLink } from '@libs/spaces-harness/space-actions';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';
import {
  currentPuzzle,
  ensureStatsOpen,
  recalled,
  required,
  servedPuzzle,
  servedPuzzleId,
  stock,
} from './puzzle-world';

/** Memo key: the stocked puzzle's id by its rating. */
const STOCKED_BY_RATING = 'stockedByRating';

function stockedRated(w: HarnessWorld, rating: number): string {
  const ids = recalled<Readonly<Record<string, string>>>(w, STOCKED_BY_RATING);
  return required(ids[String(rating)], `a stocked puzzle rated ${rating}`);
}

// ----------------------------------------------------------- the pool

Given(
  'the puzzle pool holds just one puzzle, with a popularity of {int}, played {int} times',
  async (w, popularity: number, plays: number) => {
    await w.s.apply(retireEveryPuzzle);
    const ids = await stock(w, [
      { ...GOOD_PUZZLE, rating: 1500, popularity, plays },
    ]);
    const pool = (await w.s.read(readServerPuzzles)).map((row) => row.id);
    expect(pool).toEqual([...ids]);
  }
);

Given(
  "the puzzle pool's unplayed puzzles are rated {ratings}",
  async (w, ratings: readonly number[]) => {
    await w.s.apply(retireEveryPuzzle);
    const ids = await stock(
      w,
      ratings.map((rating) => ({ ...GOOD_PUZZLE, rating }))
    );
    remember(
      w,
      STOCKED_BY_RATING,
      Object.fromEntries(
        ratings.map((rating, index) => [String(rating), ids[index]])
      )
    );
  }
);

// ------------------------------------------------------- what is served

Then(
  '{actor} is served a puzzle rated between {int} and {int}',
  async (w, actor: Actor, low: number, high: number) => {
    const rating = required(
      (await servedPuzzle(w, actor)).puzzleRating,
      "the puzzle's rating"
    );
    expect(rating).toBeGreaterThanOrEqual(low);
    expect(rating).toBeLessThanOrEqual(high);
  }
);

Then(
  '{actor} is served the puzzle rated {int}',
  async (w, actor: Actor, rating: number) => {
    expect(await servedPuzzleId(w, actor)).toBe(stockedRated(w, rating));
  }
);

Then(
  '{actor} is not offered the puzzle rated {int}',
  async (w, actor: Actor, rating: number) => {
    expect(await servedPuzzleId(w, actor)).not.toBe(stockedRated(w, rating));
  }
);

Then(
  '{actor} is served a puzzle within {int} of their new puzzle rating',
  async (w, actor: Actor, within: number) => {
    const served = required(
      (await servedPuzzle(w, actor)).puzzleRating,
      "the puzzle's rating"
    );
    await ensureStatsOpen(w, actor);
    const rating = required(
      await w.s.read(readStatsElo, actor),
      `${actor}'s puzzle rating`
    );
    expect(Math.abs(served - rating)).toBeLessThanOrEqual(within);
  }
);

// ------------------------------------------------------ another device

When('{actor} opens puzzles on their other device', async (w, actor: Actor) => {
  const device = otherDevice(actor);
  const link = required(await w.s.read(readSpaceLink, actor), 'a space');
  await w.s.apply(reopenSpaceLink, device, link);
});

Then(
  '{actor} is not offered that puzzle on their other device',
  async (w, actor: Actor) => {
    const played = currentPuzzle(w, actor);
    expect(await servedPuzzleId(w, otherDevice(actor))).not.toBe(played);
  }
);
