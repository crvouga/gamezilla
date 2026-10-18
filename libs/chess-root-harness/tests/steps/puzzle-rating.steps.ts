/**
 * The puzzle rating as a player sees it: the rating and its "?" on the
 * stats screen, the played / solved / accuracy figures, the game log, and
 * how all of that reads the same on a second device and after offline play.
 */

import { expect } from 'bun:test';
import {
  finishPuzzleBy,
  playPuzzleResults,
  playUntilSolved,
  showPersonalChessStatsScreen,
} from '@libs/chess-puzzle-harness/chess-actions';
import { seedPuzzleRating } from '@libs/chess-puzzle-harness/chess-rating-data';
import { readPuzzleRatingHistoryDirections } from '@libs/chess-puzzle-harness/puzzle-rating-history-reads';
import { PUZZLE_RATING_SCALE } from '@libs/game-session-harness/puzzle-fixtures';
import {
  isGameLogEmpty,
  readGameLogTitle,
  readStatsFigures,
  readStatsPuzzleRating,
  readStatsRatingHistory,
  readStatsRatingLabel,
} from '@libs/game-session-harness/puzzle-records';
import { returnToTabs, signInWithGoogle } from '@libs/harness/auth-actions';
import { Given, Then, When } from '@libs/harness/define';
import type { ProductHarness } from '@libs/harness/harness';
import { accountIdOf } from '@libs/harness/identity';
import type { Actor, PuzzleFinishName } from '@libs/harness/parameter-types';
import { cutConnection, otherDevice } from '@libs/harness/platform';
import { focusActor } from '@libs/harness/shell-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { remember } from '@libs/harness/spec-world';
import {
  currentPuzzle,
  ensureOnPuzzle,
  ensureStatsOpen,
  failedPuzzlesKey,
  recalled,
  required,
  SECOND_MS,
  SETTLE_MS,
  trackPuzzle,
} from './puzzle-world';

/**
 * How long another device may take to show what one device did offline,
 * when a step names no time: the returning device finds the connection
 * within its 30-second reachability backoff, uploads, and the other device
 * is pushed the result.
 */
const CONVERGE_MS = 60_000;

type Figures = {
  readonly played: number | null;
  readonly solved: number | null;
  readonly accuracy: number | null;
};

async function readFigures(
  s: ProductHarness,
  device: string
): Promise<Figures> {
  return {
    ...(await readStatsFigures(s, device)),
  };
}

/** The stats on `device` show exactly these figures (they may still sync). */
async function untilFigures(
  w: HarnessWorld,
  device: string,
  expected: Figures,
  maxMs: number
): Promise<void> {
  await ensureStatsOpen(w, device);
  const same = (f: Figures) =>
    f.played === expected.played &&
    f.solved === expected.solved &&
    f.accuracy === expected.accuracy;
  await w.s.until((surf) => readFigures(surf, device), { maxMs, pred: same });
}

/** `other`'s stats come to show the rating label `device`'s stats show. */
async function untilSameRating(
  w: HarnessWorld,
  device: string,
  other: string,
  maxMs: number
): Promise<void> {
  await ensureStatsOpen(w, device);
  const label = await w.s.until((surf) => readStatsRatingLabel(surf, device), {
    maxMs: SETTLE_MS,
    pred: (text) => text !== null && text.length > 0,
  });
  await ensureStatsOpen(w, other);
  await w.s.until((surf) => readStatsRatingLabel(surf, other), {
    maxMs,
    pred: (text) => text === label,
  });
}

// ------------------------------------------------------ the rating itself

/** A puzzle rating to set belongs to an account: sign in if not yet. */
async function withAccount(w: HarnessWorld, actor: Actor): Promise<void> {
  if ((await w.s.read(accountIdOf, actor)) !== null) return;
  await w.s.apply(signInWithGoogle, actor);
  await w.s.apply(returnToTabs, actor);
}

Given(
  "{actor}'s puzzle rating is one rated puzzle from settling",
  async (w, actor: Actor) => {
    // The deviation sits on the provisional threshold: one more rated
    // attempt settles it.
    await w.s.apply(seedPuzzleRating, actor, {
      rating: PUZZLE_RATING_SCALE.start,
      ratingDeviation: PUZZLE_RATING_SCALE.provisionalDeviation,
      volatilityMicros: PUZZLE_RATING_SCALE.startVolatilityMicros,
    });
  }
);

Given(
  "{actor}'s puzzle rating has settled at {int}",
  async (w, actor: Actor, rating: number) => {
    await withAccount(w, actor);
    // As settled as a rating gets: the deviation at its floor.
    await w.s.apply(seedPuzzleRating, actor, {
      rating,
      ratingDeviation: PUZZLE_RATING_SCALE.deviationFloor,
      volatilityMicros: PUZZLE_RATING_SCALE.startVolatilityMicros,
    });
  }
);

Given(
  '{actor} is a new solver with a provisional {int} puzzle rating',
  async (w, actor: Actor, rating: number) => {
    await withAccount(w, actor);
    // No rated attempt yet: the deviation at its ceiling.
    await w.s.apply(seedPuzzleRating, actor, {
      rating,
      ratingDeviation: PUZZLE_RATING_SCALE.startDeviation,
      volatilityMicros: PUZZLE_RATING_SCALE.startVolatilityMicros,
    });
  }
);

Then(
  "{actor}'s stats show their rating without the {string}",
  async (w, actor: Actor, marker: string) => {
    await ensureStatsOpen(w, actor);
    await w.s.until((surf) => readStatsRatingLabel(surf, actor), {
      maxMs: SETTLE_MS,
      pred: (label) =>
        label !== null && label.length > 0 && !label.includes(marker),
    });
  }
);

Then(
  "{actor}'s puzzle rating is above {int}",
  async (w, actor: Actor, rating: number) => {
    await ensureStatsOpen(w, actor);
    expect(await w.s.read(readStatsPuzzleRating, actor)).toBeGreaterThan(
      rating
    );
  }
);

Then(
  "{actor}'s puzzle rating is below {int}",
  async (w, actor: Actor, rating: number) => {
    await ensureStatsOpen(w, actor);
    expect(await w.s.read(readStatsPuzzleRating, actor)).toBeLessThan(rating);
  }
);

Then(
  "{actor}'s puzzle rating is the same as {actor}'s",
  async (w, actor: Actor, other: Actor) => {
    await ensureStatsOpen(w, other);
    const rating = required(
      await w.s.read(readStatsPuzzleRating, other),
      `${other}'s puzzle rating`
    );
    await ensureStatsOpen(w, actor);
    await w.s.until((surf) => readStatsPuzzleRating(surf, actor), {
      maxMs: SETTLE_MS,
      pred: (shown) => shown === rating,
    });
  }
);

Then(
  "{actor}'s puzzle rating is {int}",
  async (w, actor: Actor, rating: number) => {
    await ensureStatsOpen(w, actor);
    expect(await w.s.read(readStatsPuzzleRating, actor)).toBe(rating);
  }
);

// -------------------------------------------------------- offline, devices

Given('{actor} has solved a puzzle while offline', async (w, actor: Actor) => {
  await ensureOnPuzzle(w, actor);
  await cutConnection(w, actor);
  await w.s.apply(playUntilSolved, actor);
});

Given(
  '{actor} has finished the puzzle offline by {finish}',
  async (w, actor: Actor, finish: PuzzleFinishName) => {
    await cutConnection(w, actor);
    await w.s.apply(finishPuzzleBy, actor, finish);
  }
);

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

Then(
  "{actor}'s other device shows {int} played, {int} solved, and {int}% accuracy",
  async (
    w,
    actor: Actor,
    ...[played, solved, accuracy]: [number, number, number]
  ) => {
    await untilFigures(
      w,
      otherDevice(actor),
      { played, solved, accuracy },
      CONVERGE_MS
    );
  }
);

// ------------------------------------------------------ stats and game log

type PuzzleResult = 'solved' | 'failed';

/** Memo key: how each puzzle of a played run ended, in order. */
const resultsKey = (actor: Actor) => `puzzleResults:${actor}`;

Given(
  '{actor} has solved {int} puzzles and failed {int}',
  async (w, actor: Actor, solved: number, failed: number) => {
    await ensureOnPuzzle(w, actor);
    await w.s.apply(playPuzzleResults, actor, solved, 0);
    const failedIds: string[] = [];
    for (let i = 0; i < failed; i += 1) {
      failedIds.push(await trackPuzzle(w, actor));
      await w.s.apply(playPuzzleResults, actor, 0, 1);
    }
    await trackPuzzle(w, actor);
    remember(w, failedPuzzlesKey(actor), failedIds);
    // The run solves first, then fails (see `playPuzzleResults`).
    remember(w, resultsKey(actor), [
      ...Array.from({ length: solved }, (): PuzzleResult => 'solved'),
      ...Array.from({ length: failed }, (): PuzzleResult => 'failed'),
    ]);
  }
);

When('{actor} opens their stats', async (w, actor: Actor) => {
  await w.s.apply(showPersonalChessStatsScreen, actor);
});

Then(
  "{actor}'s stats show a rating of {string}",
  async (w, actor: Actor, label: string) => {
    await ensureStatsOpen(w, actor);
    expect(await w.s.read(readStatsRatingLabel, actor)).toBe(label);
  }
);

Then(
  "{actor}'s stats show {int} played, {int} solved, and {int}% accuracy",
  async (
    w,
    actor: Actor,
    ...[played, solved, accuracy]: [number, number, number]
  ) => {
    await untilFigures(w, actor, { played, solved, accuracy }, SETTLE_MS);
  }
);

Then(
  "{actor}'s stats show their rating after each of those {int} puzzles",
  async (w, actor: Actor, count: number) => {
    const results = recalled<readonly PuzzleResult[]>(w, resultsKey(actor));
    expect(results).toHaveLength(count);
    await ensureStatsOpen(w, actor);
    const history = await w.s.until(
      (surf) => readStatsRatingHistory(surf, actor),
      { maxMs: SETTLE_MS, pred: (ratings) => ratings.length === count }
    );
    // Oldest first: each solve raised the rating and each failure lowered
    // it, and the last is the rating the stats show now.
    expect(await w.s.read(readPuzzleRatingHistoryDirections, actor)).toEqual([
      ...results,
    ]);
    expect(history.at(-1)).toBe(
      required(
        await w.s.read(readStatsPuzzleRating, actor),
        `${actor}'s rating`
      )
    );
  }
);

/** How the game log titles a puzzle that ended each way. */
const LOG_TITLES: Partial<Record<string, RegExp>> = {
  solved: /^Solved/,
  failed: /^Failed/,
  abandoned: /^Abandoned/,
};

Then(
  "{actor}'s game log records that puzzle as {word}",
  async (w, actor: Actor, outcome: string) => {
    const title = LOG_TITLES[outcome];
    if (title === undefined) {
      throw new Error(`no game log outcome "${outcome}"`);
    }
    await ensureStatsOpen(w, actor);
    await w.s.until(
      (surf) => readGameLogTitle(surf, actor, currentPuzzle(w, actor)),
      { maxMs: SETTLE_MS, pred: (text) => text !== null && title.test(text) }
    );
  }
);

Then(
  "{actor}'s game log is empty within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    await w.s.apply(focusActor, actor);
    await w.s.until((surf) => isGameLogEmpty(surf, actor), {
      maxMs: seconds * SECOND_MS,
    });
  }
);
