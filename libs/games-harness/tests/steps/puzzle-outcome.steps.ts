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
} from '@libs/game-session-harness/puzzle-moves';
import {
  readCataloguePuzzles,
  readGameLogTitle,
  readStatsFigures,
  readStatsPuzzleRating,
} from '@libs/game-session-harness/puzzle-records';
import type { ShownRatingChange } from '@libs/game-session-harness/puzzle-screen';
import {
  isPuzzleOwnRatingShown,
  isPuzzleThemesShown,
  isPuzzleUnratedShown,
  moveOnToNextPuzzle,
  readPuzzleOnBoard,
  readPuzzleState,
  readShownRatingChange,
} from '@libs/game-session-harness/puzzle-screen';
import { Given, Then } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { focusActor } from '@libs/harness/shell-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { joinViaLink } from '@libs/spaces-harness/space-actions';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';
import { gameOf } from './game-world';
import {
  currentPuzzle,
  ensureOnPuzzle,
  enterKnownPuzzle,
  focusPuzzle,
  focusStats,
  puzzleGameId,
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

async function ratingOf(w: HarnessWorld, actor: Actor): Promise<number> {
  await focusStats(w, actor);
  const rating = await w.s.until((surf) => readStatsPuzzleRating(surf, actor), {
    maxMs: SETTLE_MS,
    pred: (shown) => shown !== null,
  });
  if (rating === null) throw new Error(`${actor} sees no puzzle rating`);
  return rating;
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

Then(
  "{actor}'s stats show {int} played, {int} solved, and {int}% accuracy",
  async (
    w,
    actor: Actor,
    ...[played, solved, accuracy]: [number, number, number]
  ) => {
    await focusStats(w, actor);
    await w.s.until((surf) => readStatsFigures(surf, actor), {
      maxMs: SETTLE_MS,
      pred: (figures) =>
        figures.played === played &&
        figures.solved === solved &&
        figures.accuracy === accuracy,
    });
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

Given('the puzzle pool holds just three puzzles', async (w) => {
  const known = knownPuzzlesOf(gameOf(w)).map((fixture) => fixture.record.id);
  const namespace =
    gameOf(w).shared.turnGame.capabilities.puzzles?.namespace ?? '';
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
  }
);

// ------------------------------------------------------------- watching

Given(
  "{actor} is watching {actor}'s puzzle",
  async (w, watcher: Actor, host: Actor) => {
    await ensureOnPuzzle(w, host);
    await w.s.apply(focusActor, host);
    const link = await w.s.read(readSpaceLink, host);
    if (link === null) throw new Error(`${host} is not in a space`);
    await w.s.apply(joinViaLink, watcher, link);
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
