/**
 * The puzzle rating as a player sees it: the rating and its "?" on the
 * stats screen, the played / solved / accuracy figures, the game log, and
 * how all of that reads the same on a second device and after offline play.
 */

import { expect } from 'bun:test';
import {
  finishPuzzleBy,
  playUntilSolved,
} from '@libs/chess-puzzle-harness/chess-actions';
import { NAMED_PUZZLES } from '@libs/chess-puzzle-harness/puzzle-fixtures';
import { CHESS_GAME_ID } from '@libs/chess-root-harness/chess-playable';
import { PUZZLE_RATING_SCALE } from '@libs/game-session-harness/puzzle-fixtures';
import { seedPuzzleRating } from '@libs/game-session-harness/puzzle-pool';
import {
  isGameLogEmpty,
  readGameLogTitle,
  readStatsFigures,
  readStatsPuzzleRating,
  readStatsRatingLabel,
} from '@libs/game-session-harness/puzzle-records';
import { returnToTabs, signInWithGoogle } from '@libs/harness/auth-actions';
import { Given, Then } from '@libs/harness/define';
import type { ProductHarness } from '@libs/harness/harness';
import { accountIdOf } from '@libs/harness/identity';
import type { Actor, PuzzleFinishName } from '@libs/harness/parameter-types';
import { cutConnection, otherDevice } from '@libs/harness/platform';
import { focusActor } from '@libs/harness/shell-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';
import {
  currentPuzzle,
  ensureStatsOpen,
  enterNamedPuzzle,
  SECOND_MS,
  SETTLE_MS,
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
  "{actor}'s puzzle rating has settled at {int}",
  async (w, actor: Actor, rating: number) => {
    await withAccount(w, actor);
    // As settled as a rating gets: the deviation at its floor.
    await w.s.apply(seedPuzzleRating, actor, CHESS_GAME_ID, {
      rating,
      ratingDeviation: PUZZLE_RATING_SCALE.deviationFloor,
      volatilityMicros: PUZZLE_RATING_SCALE.startVolatilityMicros,
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
  "{actor}'s puzzle rating is {int}",
  async (w, actor: Actor, rating: number) => {
    await ensureStatsOpen(w, actor);
    expect(await w.s.read(readStatsPuzzleRating, actor)).toBe(rating);
  }
);

// -------------------------------------------------------- offline, devices

Given('{actor} has solved the hook-mate puzzle', async (w, actor: Actor) => {
  await enterNamedPuzzle(w, actor, NAMED_PUZZLES.hookMate);
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
