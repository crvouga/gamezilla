/**
 * The puzzle rating at the run's game's puzzles: a rating settled or
 * provisional before the scenario, two solvers compared after puzzles of
 * known rating, the rating floor and ceiling, a solve offline and on two
 * devices, and the stats that show it.
 */

import { expect } from 'bun:test';
import { PUZZLE_RATING_SCALE } from '@libs/game-session-harness-ts/puzzle-fixtures';
import {
  playKnownWrongMove,
  solveKnownPuzzle,
} from '@libs/game-session-harness-ts/puzzle-moves';
import type { SeededPuzzleRating } from '@libs/game-session-harness-ts/puzzle-pool';
import { seedPuzzleRating } from '@libs/game-session-harness-ts/puzzle-pool';
import {
  readStatsPuzzleRating,
  readStatsRatingDirections,
  readStatsRatingHistory,
  readStatsRatingLabel,
  showPersonalPuzzleStats,
} from '@libs/game-session-harness-ts/puzzle-records';
import {
  moveOnToNextPuzzle,
  skipGamePuzzle,
} from '@libs/game-session-harness-ts/puzzle-screen';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { cutConnection, otherDevice } from '@libs/harness-ts/platform';
import { focusActor } from '@libs/harness-ts/shell-actions';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import {
  ensureOnPuzzle,
  enterKnownPuzzleRated,
  failedPuzzlesKey,
  focusPuzzle,
  focusStats,
  puzzleGameId,
  ratingOf,
  SECOND_MS,
  SETTLE_MS,
  trackPuzzle,
  withAccount,
} from './puzzle-world';

/** Memo key: how each puzzle of a played run ended, in order. */
const resultsKey = (actor: string) => `puzzle-results:${actor}`;

async function seedRating(
  w: HarnessWorld,
  actor: Actor,
  state: SeededPuzzleRating
): Promise<void> {
  await withAccount(w, actor);
  await w.s.apply(seedPuzzleRating, actor, puzzleGameId(w), state);
}

/** `device`'s stats come to show a rating `holds` of. */
async function untilRating(
  w: HarnessWorld,
  device: string,
  holds: (rating: number) => boolean,
  maxMs = SETTLE_MS
): Promise<void> {
  await focusStats(w, device);
  await w.s.until((surf) => readStatsPuzzleRating(surf, device), {
    maxMs,
    pred: (rating) => rating !== null && holds(rating),
  });
}

/** `other`'s stats come to label the rating as `device`'s stats do. */
async function untilSameRating(
  w: HarnessWorld,
  device: string,
  other: string,
  maxMs: number
): Promise<void> {
  await focusStats(w, device);
  const label = await w.s.until((surf) => readStatsRatingLabel(surf, device), {
    maxMs: SETTLE_MS,
    pred: (text) => text !== null && text.length > 0,
  });
  await focusStats(w, other);
  await w.s.until((surf) => readStatsRatingLabel(surf, other), {
    maxMs,
    pred: (text) => text === label,
  });
}

// ---------------------------------------------- a rating before the scenario

Given(
  "{actor}'s puzzle rating is one rated puzzle from settling",
  async (w, actor: Actor) => {
    // The deviation on the provisional threshold: one more rated attempt
    // settles it.
    await seedRating(w, actor, {
      rating: PUZZLE_RATING_SCALE.start,
      ratingDeviation: PUZZLE_RATING_SCALE.provisionalDeviation,
      volatilityMicros: PUZZLE_RATING_SCALE.startVolatilityMicros,
    });
  }
);

Given(
  "{actor}'s puzzle rating has settled at {int}",
  async (w, actor: Actor, rating: number) => {
    // As settled as a rating gets: the deviation at its floor.
    await seedRating(w, actor, {
      rating,
      ratingDeviation: PUZZLE_RATING_SCALE.deviationFloor,
      volatilityMicros: PUZZLE_RATING_SCALE.startVolatilityMicros,
    });
  }
);

Given(
  '{actor} is a new solver with a provisional {int} puzzle rating',
  async (w, actor: Actor, rating: number) => {
    // No rated attempt yet: the deviation at its ceiling.
    await seedRating(w, actor, {
      rating,
      ratingDeviation: PUZZLE_RATING_SCALE.startDeviation,
      volatilityMicros: PUZZLE_RATING_SCALE.startVolatilityMicros,
    });
  }
);

// ------------------------------------------------- puzzles of known rating

Given(
  '{actor} is solving a puzzle rated {int}',
  async (w, actor: Actor, rating: number) => {
    await enterKnownPuzzleRated(w, actor, rating);
  }
);

Given(
  '{actor} has solved a puzzle rated {int}',
  async (w, actor: Actor, rating: number) => {
    await enterKnownPuzzleRated(w, actor, rating);
    await w.s.apply(solveKnownPuzzle, actor, puzzleGameId(w));
  }
);

Given(
  '{actor} has played a wrong move on a puzzle rated {int}',
  async (w, actor: Actor, rating: number) => {
    await enterKnownPuzzleRated(w, actor, rating);
    await w.s.apply(playKnownWrongMove, actor, puzzleGameId(w));
  }
);

// ------------------------------------------------------- the rating itself

Then(
  "{actor}'s puzzle rating is above {int}",
  async (w, actor: Actor, rating: number) => {
    expect(await ratingOf(w, actor)).toBeGreaterThan(rating);
  }
);

Then(
  "{actor}'s puzzle rating is above {actor}'s",
  async (w, actor: Actor, other: Actor) => {
    const others = await ratingOf(w, other);
    await untilRating(w, actor, (rating) => rating > others);
  }
);

Then(
  "{actor}'s puzzle rating is below {actor}'s",
  async (w, actor: Actor, other: Actor) => {
    const others = await ratingOf(w, other);
    await untilRating(w, actor, (rating) => rating < others);
  }
);

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

// -------------------------------------------------- offline, two devices

Given('{actor} has solved a puzzle while offline', async (w, actor: Actor) => {
  await ensureOnPuzzle(w, actor);
  await cutConnection(w, actor);
  await focusPuzzle(w, actor);
  await w.s.apply(solveKnownPuzzle, actor, puzzleGameId(w));
});

Then(
  "both of {actor}'s devices show the same puzzle rating within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    await untilSameRating(w, actor, otherDevice(actor), seconds * SECOND_MS);
  }
);

Then(
  "{actor}'s other device shows the same puzzle rating within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    await untilSameRating(w, actor, otherDevice(actor), seconds * SECOND_MS);
  }
);

// ------------------------------------------------------------------ stats

Given(
  '{actor} has solved {int} puzzles and failed {int}',
  async (w, actor: Actor, solved: number, failed: number) => {
    await ensureOnPuzzle(w, actor);
    await focusPuzzle(w, actor);
    const failedIds: string[] = [];
    for (let played = 0; played < solved + failed; played += 1) {
      if (played > 0) {
        await w.s.apply(moveOnToNextPuzzle, actor);
        await trackPuzzle(w, actor);
      }
      if (played < solved) {
        await w.s.apply(solveKnownPuzzle, actor, puzzleGameId(w));
      } else {
        // A wrong move, then the puzzle skipped: failed.
        failedIds.push(await trackPuzzle(w, actor));
        await w.s.apply(playKnownWrongMove, actor, puzzleGameId(w));
        await w.s.apply(skipGamePuzzle, actor);
      }
    }
    w.memo.set(failedPuzzlesKey(actor), failedIds);
    w.memo.set(resultsKey(actor), [
      ...Array.from({ length: solved }, () => 'raised'),
      ...Array.from({ length: failed }, () => 'lowered'),
    ]);
  }
);

When('{actor} opens their stats', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.apply(showPersonalPuzzleStats, actor, puzzleGameId(w));
});

Then(
  "{actor}'s stats show a puzzle rating of {string}",
  async (w, actor: Actor, label: string) => {
    await focusStats(w, actor);
    await w.s.until((surf) => readStatsRatingLabel(surf, actor), {
      maxMs: SETTLE_MS,
      pred: (shown) => shown === label,
    });
  }
);

Then(
  "{actor}'s stats show their puzzle rating without the {string}",
  async (w, actor: Actor, marker: string) => {
    await focusStats(w, actor);
    await w.s.until((surf) => readStatsRatingLabel(surf, actor), {
      maxMs: SETTLE_MS,
      pred: (label) =>
        label !== null && label.length > 0 && !label.includes(marker),
    });
  }
);

Then(
  "{actor}'s stats show their puzzle rating after each of those {int} puzzles",
  async (w, actor: Actor, count: number) => {
    const results = (w.memo.get(resultsKey(actor)) ?? []) as readonly (
      | 'raised'
      | 'lowered'
    )[];
    expect(results).toHaveLength(count);
    await focusStats(w, actor);
    const history = await w.s.until(
      (surf) => readStatsRatingHistory(surf, actor),
      { maxMs: SETTLE_MS, pred: (ratings) => ratings.length === count }
    );
    // Oldest first: each solve raised the rating and each failure lowered
    // it, and the last is the rating the stats show now.
    expect(await w.s.read(readStatsRatingDirections, actor)).toEqual(results);
    expect(history.at(-1)).toBe(await ratingOf(w, actor));
  }
);
