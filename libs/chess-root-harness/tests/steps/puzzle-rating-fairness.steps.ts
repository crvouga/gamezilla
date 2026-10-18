/**
 * A fair puzzle rating: two solvers' ratings compared after puzzles of known
 * difficulty, the rating floor and ceiling, and time taken.
 */

import { expect } from 'bun:test';
import {
  playUntilSolved,
  playWrongPuzzleMove,
} from '@libs/chess-puzzle-harness/chess-actions';
import { NAMED_PUZZLES } from '@libs/chess-puzzle-harness/puzzle-fixtures';
import { readStatsPuzzleRating } from '@libs/game-session-harness/puzzle-records';
import { Given, Then } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';
import {
  ensureStatsOpen,
  enterNamedPuzzle,
  enterStockedPuzzle,
  required,
  SETTLE_MS,
} from './puzzle-world';

async function ratingOf(w: HarnessWorld, actor: Actor): Promise<number> {
  await ensureStatsOpen(w, actor);
  return required(
    await w.s.until((surf) => readStatsPuzzleRating(surf, actor), {
      maxMs: SETTLE_MS,
      pred: (rating) => rating !== null,
    }),
    `${actor}'s puzzle rating`
  );
}

/** `actor`'s stats come to show a rating that `holds` against `other`'s. */
async function untilRatingAgainst(
  w: HarnessWorld,
  actor: Actor,
  other: Actor,
  holds: (rating: number, others: number) => boolean
): Promise<void> {
  const others = await ratingOf(w, other);
  await ensureStatsOpen(w, actor);
  await w.s.until((surf) => readStatsPuzzleRating(surf, actor), {
    maxMs: SETTLE_MS,
    pred: (rating) => rating !== null && holds(rating, others),
  });
}

// ------------------------------------------------- puzzles of known rating

Given(
  '{actor} is solving a puzzle rated {int}',
  async (w, actor: Actor, rating: number) => {
    await enterStockedPuzzle(w, actor, rating);
  }
);

Given(
  '{actor} has solved a puzzle rated {int}',
  async (w, actor: Actor, rating: number) => {
    await enterStockedPuzzle(w, actor, rating);
    await w.s.apply(playUntilSolved, actor);
  }
);

Given(
  '{actor} has played a wrong move on a puzzle rated {int}',
  async (w, actor: Actor, rating: number) => {
    await enterStockedPuzzle(w, actor, rating);
    await w.s.apply(playWrongPuzzleMove, actor);
  }
);

Given('{actor} has solved the hook-mate puzzle', async (w, actor: Actor) => {
  await enterNamedPuzzle(w, actor, NAMED_PUZZLES.hookMate);
  await w.s.apply(playUntilSolved, actor);
});

// ---------------------------------------------------- comparing solvers

Then(
  "{actor}'s puzzle rating is above {actor}'s",
  async (w, actor: Actor, other: Actor) => {
    await untilRatingAgainst(w, actor, other, (rating, others) => {
      return rating > others;
    });
  }
);

Then(
  "{actor}'s puzzle rating is below {actor}'s",
  async (w, actor: Actor, other: Actor) => {
    await untilRatingAgainst(w, actor, other, (rating, others) => {
      return rating < others;
    });
  }
);

// --------------------------------------------------- floor and ceiling

Then(
  "{actor}'s puzzle rating cannot go below {int}",
  async (w, actor: Actor, floor: number) => {
    expect(await ratingOf(w, actor)).toBeGreaterThanOrEqual(floor);
  }
);

Then(
  "{actor}'s puzzle rating cannot go above {int}",
  async (w, actor: Actor, ceiling: number) => {
    expect(await ratingOf(w, actor)).toBeLessThanOrEqual(ceiling);
  }
);
