/**
 * Choosing the next puzzle of the run's game: a pool made of its known
 * puzzles with the quality and ratings a scenario names, which of them the
 * feed serves, and what the solver's other device serves.
 */

import { expect } from 'bun:test';
import {
  knownPuzzlesOf,
  theKnownPuzzle,
} from '@libs/game-session-harness/puzzle-moves';
import { readPuzzleOnBoard } from '@libs/game-session-harness/puzzle-screen';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { otherDevice } from '@libs/harness/platform';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { gameOf } from './game-world';
import {
  currentPuzzle,
  focusPuzzle,
  otherDevicePuzzles,
  ownRatingOf,
  poolIds,
  ratingOf,
  required,
  SETTLE_MS,
  servedPuzzle,
  writePool,
} from './puzzle-world';

/** Memo key: the pool's puzzle of each rating the scenario names. */
const RATED = 'puzzle-pool:by-rating';

function ratedPuzzle(w: HarnessWorld, rating: number): string {
  const ids = (w.memo.get(RATED) ?? {}) as Readonly<Record<string, string>>;
  return required(ids[String(rating)], `a puzzle rated ${rating} in the pool`);
}

// ---------------------------------------------------------------- the pool

Given(
  'the puzzle pool holds just one puzzle, with a popularity of {int}, played {int} times',
  async (w, popularity: number, plays: number) => {
    const { id } = theKnownPuzzle(gameOf(w)).record;
    await writePool(w, [{ id, popularity, plays }]);
    // Precondition guard: that puzzle is the whole pool.
    expect(await poolIds(w)).toEqual([id]);
  }
);

Given(
  "the puzzle pool's unplayed puzzles are rated {ratings}",
  async (w, ratings: readonly number[]) => {
    const known = knownPuzzlesOf(gameOf(w));
    const pool = ratings.map((rating, index) => ({
      id: required(known[index], `a known puzzle to rate ${rating}`).record.id,
      rating,
    }));
    await writePool(w, pool);
    w.memo.set(
      RATED,
      Object.fromEntries(pool.map(({ id, rating }) => [String(rating), id]))
    );
  }
);

// ------------------------------------------------------- what is served

Then(
  '{actor} is served a puzzle rated between {int} and {int}',
  async (w, actor: Actor, low: number, high: number) => {
    const rating = await ownRatingOf(w, await servedPuzzle(w, actor));
    expect(rating).toBeGreaterThanOrEqual(low);
    expect(rating).toBeLessThanOrEqual(high);
  }
);

Then(
  '{actor} is served the puzzle rated {int}',
  async (w, actor: Actor, rating: number) => {
    expect(await servedPuzzle(w, actor)).toBe(ratedPuzzle(w, rating));
  }
);

Then(
  '{actor} is not offered the puzzle rated {int}',
  async (w, actor: Actor, rating: number) => {
    expect(await servedPuzzle(w, actor)).not.toBe(ratedPuzzle(w, rating));
  }
);

Then(
  '{actor} is served a puzzle within {int} of their new puzzle rating',
  async (w, actor: Actor, within: number) => {
    const served = await ownRatingOf(w, await servedPuzzle(w, actor));
    const rating = await ratingOf(w, actor);
    expect(Math.abs(served - rating)).toBeLessThanOrEqual(within);
  }
);

// --------------------------------------------------------- another device

When('{actor} opens puzzles on their other device', async (w, actor: Actor) => {
  await otherDevicePuzzles(w, actor);
});

Then(
  '{actor} is not offered that puzzle on their other device',
  async (w, actor: Actor) => {
    const played = currentPuzzle(w, actor);
    const device = otherDevice(actor);
    await focusPuzzle(w, device);
    const onBoard = await w.s.until((surf) => readPuzzleOnBoard(surf, device), {
      maxMs: SETTLE_MS,
      pred: (id) => id !== null,
    });
    expect(onBoard).not.toBe(played);
  }
);
