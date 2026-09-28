/**
 * The daily rated-puzzle allowance as people meet it: a guest's puzzles
 * start until the day's limit (online or not), the puzzle on the board can
 * still be finished, the next one is refused with an invitation rather than
 * an error, and a new day brings a fresh allowance; accounts never meet a
 * limit. Coming back to a puzzle already started is no new start
 * (`specs/chess/puzzle-session.qnt` counts the device's starts); the ledger
 * rules are in `libs/permissions/tests/consume-quota.test.ts`.
 */

import { expect } from 'bun:test';

import {
  playUntilSolved,
  pressPuzzleNext,
  pressPuzzleNextNoWait,
  sleepUntilNextUtcDay,
} from '@libs/chess/harness/chess-actions';
import {
  readLocalPuzzleStartLedger,
  useUpPuzzleStartsToday,
} from '@libs/chess/harness/chess-puzzle-ledger-data';
import {
  isPuzzleLimitSignInOffered,
  isPuzzleLimitVisible,
} from '@libs/chess/harness/chess-puzzle-ui';
import {
  type Actor,
  Given,
  type HarnessWorld,
  Then,
  When,
} from '@libs/harness/spec/define';
import {
  enterPuzzles,
  SECOND_MS,
  SETTLE_MS,
  trackPuzzle,
} from './puzzle-world';

/** The shipped policy's rated puzzle starts a guest gets per day (GOAL). */
const GUEST_DAILY_PUZZLE_STARTS = 20;

/** On a puzzle after `starts` puzzle starts today, this one included. */
async function afterStartsToday(w: HarnessWorld, actor: Actor, starts: number) {
  await enterPuzzles(w, actor);
  await w.s.apply(useUpPuzzleStartsToday, actor, starts);
}

/** `starts` puzzles played today, the last one solved. */
async function playedToday(w: HarnessWorld, actor: Actor, starts: number) {
  await afterStartsToday(w, actor, starts);
  await w.s.apply(playUntilSolved, actor);
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
    await w.s.apply(pressPuzzleNextNoWait, actor);
    await w.s.until((surf) => isPuzzleLimitVisible(surf, actor), {
      maxMs: SETTLE_MS,
    });
  }
);

Given(
  '{actor} has solved the twentieth puzzle of the day',
  async (w, actor: Actor) => {
    await w.s.apply(pressPuzzleNext, actor);
    await trackPuzzle(w, actor);
    // Precondition guard: this start is the day's twentieth.
    const starts = await w.s.read(readLocalPuzzleStartLedger, actor);
    expect(starts.length).toBe(GUEST_DAILY_PUZZLE_STARTS);
    await w.s.apply(playUntilSolved, actor);
  }
);

When('{actor} asks for another puzzle', async (w, actor: Actor) => {
  await w.s.apply(pressPuzzleNextNoWait, actor);
});

When('the next day begins', async (w) => {
  await w.s.apply(sleepUntilNextUtcDay);
});

Then('{actor} is not shown the puzzle limit', async (w, actor: Actor) => {
  expect(await w.s.read(isPuzzleLimitVisible, actor)).toBe(false);
});

Then(
  '{actor} is shown the puzzle limit within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.until((surf) => isPuzzleLimitVisible(surf, actor), {
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
