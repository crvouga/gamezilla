/**
 * What a puzzle of the run's game comes to: the rating change the solver
 * sees (or that the attempt is unrated), the puzzle's own rating and
 * themes once it is over, the puzzle rating, stats and game log, the pool
 * the feed comes round through, and a watcher's board.
 */

import { expect } from 'bun:test';
import {
  knownPuzzlesOf,
  solveKnownPuzzle,
} from '@libs/game-session-harness-ts/puzzle-moves';
import {
  readCataloguePuzzles,
  readGameLogRow,
  readGameLogTitle,
  readStatsFigures,
  readStatsPuzzleRating,
} from '@libs/game-session-harness-ts/puzzle-records';
import type { ShownRatingChange } from '@libs/game-session-harness-ts/puzzle-screen';
import {
  isPuzzleOwnRatingShown,
  isPuzzleThemesShown,
  isPuzzleUnratedShown,
  moveOnToNextPuzzle,
  readPuzzleOnBoard,
  readPuzzleState,
  readShownRatingChange,
} from '@libs/game-session-harness-ts/puzzle-screen';
import { Given, Then } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { otherDevice } from '@libs/harness-ts/platform';
import { focusActor } from '@libs/harness-ts/shell-actions';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { joinHostsSpace, turnGameOf } from './game-world';
import {
  currentPuzzle,
  ensureOnPuzzle,
  enterKnownPuzzle,
  focusPuzzle,
  focusStats,
  ownRatingOf,
  puzzleGameId,
  ratingOf,
  SECOND_MS,
  SETTLE_MS,
  trackPuzzle,
} from './puzzle-world';

async function untilRatingChange(
  w: HarnessWorld,
  actor: Actor,
  change: ShownRatingChange
): Promise<void> {
  await focusPuzzle(w, actor);
  await w.s.until((surf) => readShownRatingChange(surf, actor), {
    maxMs: SETTLE_MS,
    pred: (shown) => shown === change,
  });
}

// ------------------------------------------------------- the rating change

Then(
  '{actor} sees a rating change that raised their puzzle rating',
  async (w, actor: Actor) => {
    await untilRatingChange(w, actor, 'raised');
  }
);

Then(
  '{actor} sees a rating change that lowered their puzzle rating',
  async (w, actor: Actor) => {
    await untilRatingChange(w, actor, 'lowered');
  }
);

Then('{actor} sees no rating change', async (w, actor: Actor) => {
  await focusPuzzle(w, actor);
  expect(await w.s.read(readShownRatingChange, actor)).not.toBeOneOf([
    'raised',
    'lowered',
    'unchanged',
  ]);
});

Then('{actor} is told the attempt is unrated', async (w, actor: Actor) => {
  await focusPuzzle(w, actor);
  await w.s.until((surf) => isPuzzleUnratedShown(surf, actor), {
    maxMs: SETTLE_MS,
  });
});

// --------------------------------------- the puzzle's own rating and themes

Then("{actor} can see the puzzle's own rating", async (w, actor: Actor) => {
  await focusPuzzle(w, actor);
  await w.s.until((surf) => isPuzzleOwnRatingShown(surf, actor), {
    maxMs: SETTLE_MS,
  });
});

Then("{actor} cannot see the puzzle's own rating", async (w, actor: Actor) => {
  await focusPuzzle(w, actor);
  expect(await w.s.read(isPuzzleOwnRatingShown, actor)).toBe(false);
});

Then("{actor} can see the puzzle's themes", async (w, actor: Actor) => {
  await focusPuzzle(w, actor);
  await w.s.until((surf) => isPuzzleThemesShown(surf, actor), {
    maxMs: SETTLE_MS,
  });
});

Then("{actor} cannot see the puzzle's themes", async (w, actor: Actor) => {
  await focusPuzzle(w, actor);
  expect(await w.s.read(isPuzzleThemesShown, actor)).toBe(false);
});

// ------------------------------------------- puzzle rating, stats, game log

Then(
  "{actor}'s puzzle rating is {int}",
  async (w, actor: Actor, rating: number) => {
    expect(await ratingOf(w, actor)).toBe(rating);
  }
);

Then(
  "{actor}'s puzzle rating is below {int}",
  async (w, actor: Actor, rating: number) => {
    expect(await ratingOf(w, actor)).toBeLessThan(rating);
  }
);

Then(
  "{actor}'s puzzle rating is the same as {actor}'s",
  async (w, actor: Actor, other: Actor) => {
    const others = await ratingOf(w, other);
    await focusStats(w, actor);
    await w.s.until((surf) => readStatsPuzzleRating(surf, actor), {
      maxMs: SETTLE_MS,
      pred: (shown) => shown === others,
    });
  }
);

type Figures = {
  readonly played: number;
  readonly solved: number;
  readonly accuracy: number;
};

/** `device`'s stats come to show `expected`'s figures. */
async function untilFigures(
  w: HarnessWorld,
  device: string,
  expected: Figures,
  maxMs = SETTLE_MS
): Promise<void> {
  await focusStats(w, device);
  await w.s.until((surf) => readStatsFigures(surf, device), {
    maxMs,
    pred: (figures) =>
      figures.played === expected.played &&
      figures.solved === expected.solved &&
      figures.accuracy === expected.accuracy,
  });
}

/**
 * How long another device may take to show what one device played, when a
 * step names no time: it syncs once it opens the account.
 */
const CONVERGE_MS = 60_000;

Then(
  "{actor}'s stats show {int} played, {int} solved, and {int}% accuracy",
  async (
    w,
    actor: Actor,
    ...[played, solved, accuracy]: [number, number, number]
  ) => {
    await untilFigures(w, actor, { played, solved, accuracy });
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
    if (title === undefined) throw new Error(`no game log outcome ${outcome}`);
    const puzzle = currentPuzzle(w, actor);
    await focusStats(w, actor);
    await w.s.until((surf) => readGameLogTitle(surf, actor, puzzle), {
      maxMs: SETTLE_MS,
      pred: (text) => text !== null && title.test(text),
    });
  }
);

// --------------------------------------------- the pool, and coming round

const firstPlayedKey = (actor: string) => `puzzle-first-played:${actor}`;
const ratingBeforeRepeatKey = (actor: string) =>
  `puzzle-rating-before-repeat:${actor}`;

Given('the puzzle pool holds just three puzzles', async (w) => {
  const known = knownPuzzlesOf(turnGameOf(w)).map(
    (fixture) => fixture.record.id
  );
  const namespace =
    turnGameOf(w).shared.registration.capabilities.puzzles?.namespace ?? '';
  // Precondition guard: the world's pool is the game's three known puzzles.
  expect(known).toHaveLength(3);
  expect(await w.s.read(readCataloguePuzzles, namespace)).toEqual(
    [...known].sort()
  );
});

Given(
  '{actor} has solved {int} puzzles in a row',
  async (w, actor: Actor, count: number) => {
    await ensureOnPuzzle(w, actor);
    w.memo.set(firstPlayedKey(actor), currentPuzzle(w, actor));
    for (let solved = 0; solved < count; solved += 1) {
      if (solved > 0) {
        await w.s.apply(moveOnToNextPuzzle, actor);
        await trackPuzzle(w, actor);
      }
      await w.s.apply(solveKnownPuzzle, actor, puzzleGameId(w));
    }
  }
);

Given(
  "{actor}'s feed has come round to a puzzle they already played",
  async (w, actor: Actor) => {
    await w.s.apply(focusActor, actor);
    await w.s.apply(moveOnToNextPuzzle, actor);
    const first = String(w.memo.get(firstPlayedKey(actor)));
    // Precondition guard: the feed served the first puzzle played again.
    await w.s.until((surf) => readPuzzleOnBoard(surf, actor), {
      maxMs: SETTLE_MS,
      pred: (id) => id === first,
    });
    await trackPuzzle(w, actor);
    // The puzzle rating before the repeat, as the stats show it.
    w.memo.set(ratingBeforeRepeatKey(actor), await ratingOf(w, actor));
    await focusPuzzle(w, actor);
  }
);

Given('{actor} has moved on to the next puzzle', async (w, actor: Actor) => {
  await focusPuzzle(w, actor);
  await w.s.apply(moveOnToNextPuzzle, actor);
  await trackPuzzle(w, actor);
});

Then(
  "{actor}'s feed comes round to the first puzzle they played within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    const first = String(w.memo.get(firstPlayedKey(actor)));
    await focusPuzzle(w, actor);
    await w.s.until((surf) => readPuzzleOnBoard(surf, actor), {
      maxMs: seconds * SECOND_MS,
      pred: (id) => id === first,
    });
    await trackPuzzle(w, actor);
  }
);

Then(
  "{actor}'s puzzle rating is still unchanged by the repeat because that puzzle is already rated",
  async (w, actor: Actor) => {
    const before = w.memo.get(ratingBeforeRepeatKey(actor));
    await focusStats(w, actor);
    await w.s.until((surf) => readStatsPuzzleRating(surf, actor), {
      maxMs: SETTLE_MS,
      pred: (shown) => shown !== null,
    });
    expect(await w.s.read(readStatsPuzzleRating, actor)).toBe(before as number);
  }
);

// ------------------------------------------------------------- game log

Then(
  "{actor}'s game log shows that puzzle's own rating and its rating change",
  async (w, actor: Actor) => {
    const puzzle = currentPuzzle(w, actor);
    const own = await ownRatingOf(w, puzzle);
    await focusStats(w, actor);
    const row = await w.s.until((surf) => readGameLogRow(surf, actor, puzzle), {
      maxMs: SETTLE_MS,
      pred: (shown) => typeof shown?.change === 'number',
    });
    expect(row?.puzzleRating).toBe(own);
    expect(row?.change).not.toBe(0);
  }
);

Then(
  "{actor}'s game log shows the repeat as unrated",
  async (w, actor: Actor) => {
    const puzzle = currentPuzzle(w, actor);
    await focusStats(w, actor);
    await w.s.until((surf) => readGameLogRow(surf, actor, puzzle), {
      maxMs: SETTLE_MS,
      pred: (shown) => shown?.change === 'unrated',
    });
  }
);

// ------------------------------------------------------------- watching

Given(
  "{actor} is watching {actor}'s puzzle",
  async (w, watcher: Actor, host: Actor) => {
    await ensureOnPuzzle(w, host);
    // Into the host's space from its link, unless already there.
    await joinHostsSpace(w, host, watcher);
    await w.s.apply(focusActor, watcher);
    // Precondition guard: the watcher's board shows the host's puzzle.
    await w.s.until(
      async (surf) => ({
        puzzle: await readPuzzleOnBoard(surf, watcher),
        state: await readPuzzleState(surf, watcher),
      }),
      {
        maxMs: SETTLE_MS,
        pred: (seen) =>
          seen.puzzle === currentPuzzle(w, host) && seen.state === 'solving',
      }
    );
  }
);

// ------------------------------------------------------ the known puzzle

Given("{actor} has solved the game's known puzzle", async (w, actor: Actor) => {
  await enterKnownPuzzle(w, actor);
  await w.s.apply(solveKnownPuzzle, actor, puzzleGameId(w));
});

Given(
  "{actor} has been solving the game's known puzzle for {int} minutes",
  async (w, actor: Actor, minutes: number) => {
    await enterKnownPuzzle(w, actor);
    await w.s.apply(focusActor, actor);
    await w.s.advanceTime(minutes * 60 * SECOND_MS);
  }
);
