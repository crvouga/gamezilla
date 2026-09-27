/**
 * The puzzle rating as a player sees it: the rating and its "?" on the
 * stats screen, the played / solved / accuracy figures, the game log, and
 * how all of that reads the same on a second device and after offline play.
 */

import { expect } from 'bun:test';

import {
  PUZZLE_PROVISIONAL_RD,
  PUZZLE_RATING_DEFAULT,
  PUZZLE_RATING_DEFAULT_VOLATILITY_MICROS,
} from '@libs/chess/public/chess-puzzle-rating';
import {
  finishPuzzleBy,
  playPuzzleResults,
  playUntilSolved,
} from '@libs/chess/sim/chess-actions';
import {
  isGameLogEmpty,
  readGameLogRowTitle,
  readStatsAccuracy,
  readStatsElo,
  readStatsPlayed,
  readStatsRatingLabel,
  readStatsSolved,
} from '@libs/chess/sim/chess-puzzle-ui';
import { seedPuzzleRating } from '@libs/chess/sim/chess-rating-data';
import { focusActor } from '@libs/sim-harness';
import {
  type Actor,
  Given,
  type SimWorld,
  Then,
  When,
} from '@libs/sim-harness/spec/define';
import type { PuzzleFinishName } from '@libs/sim-harness/spec/parameter-types';
import {
  cutConnection,
  otherDevice,
} from '@libs/sim-harness/spec/steps/platform';
import type { ProductSim } from '@libs/sim-harness/system/sim';
import {
  currentPuzzle,
  ensureStatsOpen,
  SECOND_MS,
  SETTLE_MS,
} from './puzzle-world';

type Figures = {
  readonly played: number | null;
  readonly solved: number | null;
  readonly accuracy: number | null;
};

async function readFigures(s: ProductSim, device: string): Promise<Figures> {
  return {
    played: await readStatsPlayed(s, device),
    solved: await readStatsSolved(s, device),
    accuracy: await readStatsAccuracy(s, device),
  };
}

/** The stats on `device` show exactly these figures (they may still sync). */
async function untilFigures(
  w: SimWorld,
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
  w: SimWorld,
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

Given(
  "{actor}'s puzzle rating is one rated puzzle from settling",
  async (w, actor: Actor) => {
    // The deviation sits on the provisional threshold: one more rated
    // attempt settles it.
    await w.s.apply(seedPuzzleRating, actor, {
      rating: PUZZLE_RATING_DEFAULT,
      ratingDeviation: PUZZLE_PROVISIONAL_RD,
      volatilityMicros: PUZZLE_RATING_DEFAULT_VOLATILITY_MICROS,
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
    expect(await w.s.read(readStatsElo, actor)).toBeGreaterThan(rating);
  }
);

Then(
  "{actor}'s puzzle rating is below {int}",
  async (w, actor: Actor, rating: number) => {
    await ensureStatsOpen(w, actor);
    expect(await w.s.read(readStatsElo, actor)).toBeLessThan(rating);
  }
);

Then(
  "{actor}'s puzzle rating is {int}",
  async (w, actor: Actor, rating: number) => {
    await ensureStatsOpen(w, actor);
    expect(await w.s.read(readStatsElo, actor)).toBe(rating);
  }
);

// -------------------------------------------------------- offline, devices

Given('{actor} has solved a puzzle while offline', async (w, actor: Actor) => {
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
      SETTLE_MS
    );
  }
);

// ------------------------------------------------------ stats and game log

Given(
  '{actor} has solved {int} puzzles and failed {int}',
  async (w, actor: Actor, solved: number, failed: number) => {
    await w.s.apply(playPuzzleResults, actor, solved, failed);
  }
);

When('{actor} opens their stats', async (w, actor: Actor) => {
  await ensureStatsOpen(w, actor);
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
      (surf) => readGameLogRowTitle(surf, actor, currentPuzzle(w, actor)),
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
