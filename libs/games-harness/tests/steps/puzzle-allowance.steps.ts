/**
 * The daily puzzle limit at the run's game's puzzles: a guest's puzzles
 * start until the day's limit (online or not), the puzzle on the board can
 * still be finished, the next one is refused with an invitation rather than
 * an error, and a new day brings a fresh allowance; accounts never meet a
 * limit. The limit is one allowance for every game offering puzzles; the
 * earlier starts of the day are written to the one ledger
 * (`@libs/game-session-harness/puzzle-allowance`), and the decision table
 * holds every case of it (`tests/dmn/daily-puzzle-limit.binding.ts`).
 */

import { expect } from 'bun:test';
import {
  readLocalPuzzleStartLedger,
  sleepUntilNextUtcDay,
  useUpPuzzleStartsToday,
} from '@libs/game-session-harness/puzzle-allowance';
import { solveKnownPuzzle } from '@libs/game-session-harness/puzzle-moves';
import {
  isPuzzleLimitShown,
  isPuzzleLimitSignInOffered,
  moveOnToNextPuzzle,
  moveOnWithoutWaiting,
  readPuzzleOnBoard,
  readPuzzleStartsLeft,
} from '@libs/game-session-harness/puzzle-screen';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { focusActor } from '@libs/harness/shell-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';
import {
  enterPuzzles,
  focusPuzzle,
  puzzleGameId,
  SECOND_MS,
  SETTLE_MS,
  trackPuzzle,
} from './puzzle-world';

/** The shipped policy's rated puzzle starts a guest gets per day (GOAL). */
const GUEST_DAILY_PUZZLE_STARTS = 20;

/** On a puzzle after `starts` puzzle starts today, this one included. */
async function afterStartsToday(
  w: HarnessWorld,
  actor: Actor,
  starts: number
): Promise<void> {
  await enterPuzzles(w, actor);
  await w.s.apply(useUpPuzzleStartsToday, actor, starts);
}

/** `starts` puzzles played today, the last one solved. */
async function playedToday(
  w: HarnessWorld,
  actor: Actor,
  starts: number
): Promise<void> {
  await afterStartsToday(w, actor, starts);
  await w.s.apply(solveKnownPuzzle, actor, puzzleGameId(w));
}

Given(
  '{actor} is a guest who has played {int} puzzles today',
  async (w, actor: Actor, played: number) => {
    await playedToday(w, actor, played);
  }
);

Given(
  '{actor} has played {int} puzzles today',
  async (w, actor: Actor, played: number) => {
    await playedToday(w, actor, played);
  }
);

Given(
  "{actor} is a guest who reached today's puzzle limit while solving a puzzle",
  async (w, actor: Actor) => {
    await afterStartsToday(w, actor, GUEST_DAILY_PUZZLE_STARTS);
  }
);

Given(
  "{actor} is a guest who has finished today's last allowed puzzle",
  async (w, actor: Actor) => {
    await playedToday(w, actor, GUEST_DAILY_PUZZLE_STARTS);
  }
);

Given(
  "{actor} is a guest who has been shown today's puzzle limit",
  async (w, actor: Actor) => {
    await playedToday(w, actor, GUEST_DAILY_PUZZLE_STARTS);
    await w.s.apply(moveOnWithoutWaiting, actor);
    // Precondition guard: the limit took the board's place.
    await w.s.until((surf) => isPuzzleLimitShown(surf, actor), {
      maxMs: SETTLE_MS,
    });
  }
);

Given(
  '{actor} has solved the twentieth puzzle of the day',
  async (w, actor: Actor) => {
    await w.s.apply(focusActor, actor);
    await w.s.apply(moveOnToNextPuzzle, actor);
    await trackPuzzle(w, actor);
    // Precondition guard: this start is the day's twentieth.
    const starts = await w.s.read(readLocalPuzzleStartLedger, actor);
    expect(starts.length).toBe(GUEST_DAILY_PUZZLE_STARTS);
    await w.s.apply(solveKnownPuzzle, actor, puzzleGameId(w));
  }
);

When('{actor} asks for another puzzle', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.apply(moveOnWithoutWaiting, actor);
});

Given('the next day has begun', async (w) => {
  await w.s.apply(sleepUntilNextUtcDay);
});

Then(
  '{actor} has a puzzle on the board within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.apply(focusActor, actor);
    await w.s.until((surf) => readPuzzleOnBoard(surf, actor), {
      maxMs: seconds * SECOND_MS,
      pred: (id) => id !== null,
    });
    await trackPuzzle(w, actor);
  }
);

Then('{actor} is not shown the puzzle limit', async (w, actor: Actor) => {
  await focusPuzzle(w, actor);
  expect(await w.s.read(isPuzzleLimitShown, actor)).toBe(false);
});

Then(
  "{actor} is told no new puzzle can start because today's allowance is used within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    await w.s.apply(focusActor, actor);
    await w.s.until((surf) => isPuzzleLimitShown(surf, actor), {
      maxMs: seconds * SECOND_MS,
    });
  }
);

Then(
  '{actor} is invited to sign in for more puzzles',
  async (w, actor: Actor) => {
    expect(await w.s.read(isPuzzleLimitSignInOffered, actor)).toBe(true);
  }
);

Then(
  '{actor} can read that {int} rated puzzles remain today',
  async (w, actor: Actor, remaining: number) => {
    await w.s.apply(focusActor, actor);
    const shown = await w.s.until((s) => readPuzzleStartsLeft(s, actor), {
      pred: (value) => value === remaining,
      maxMs: SETTLE_MS,
    });
    expect(shown).toBe(remaining);
  }
);
