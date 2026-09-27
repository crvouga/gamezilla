/**
 * The daily rated-puzzle allowance as a guest meets it: puzzles start until
 * the day's limit, the puzzle on the board can still be finished, and the
 * next one is refused with an invitation rather than an error. Coming back
 * to a puzzle already started is no new start (`specs/chess/puzzle-session.qnt`
 * counts the device's starts); the ledger rules are in
 * `libs/permissions/tests/consume-quota.test.ts`.
 */

import { expect } from 'bun:test';

import {
  openPuzzleFromSpace,
  playUntilSolved,
  pressPuzzleNextNoWait,
} from '@libs/chess/sim/chess-actions';
import { useUpPuzzleStartsToday } from '@libs/chess/sim/chess-puzzle-ledger-data';
import {
  isPuzzleLimitSignInOffered,
  isPuzzleLimitVisible,
} from '@libs/chess/sim/chess-puzzle-ui';
import {
  type Actor,
  Given,
  type SimWorld,
  Then,
  When,
} from '@libs/sim-harness/spec/define';
import { createSpace } from '@libs/spaces/sim/space-actions';
import { SECOND_MS, SETTLE_MS, trackPuzzle } from './puzzle-world';

/** The shipped policy's rated puzzle starts a guest gets per day (GOAL). */
const GUEST_DAILY_PUZZLE_STARTS = 20;

/** A guest on a puzzle after `starts` puzzle starts today, this one included. */
async function guestAfterStarts(w: SimWorld, actor: Actor, starts: number) {
  await w.s.apply(createSpace, actor);
  await w.s.apply(openPuzzleFromSpace, actor);
  await trackPuzzle(w, actor);
  await w.s.apply(useUpPuzzleStartsToday, actor, starts);
}

Given(
  '{actor} is a guest who has played {int} puzzles today',
  async (w, actor: Actor, played: number) => {
    await guestAfterStarts(w, actor, played);
    await w.s.apply(playUntilSolved, actor);
  }
);

Given(
  "{actor} is a guest who reached today's puzzle limit while solving a puzzle",
  async (w, actor: Actor) => {
    await guestAfterStarts(w, actor, GUEST_DAILY_PUZZLE_STARTS);
  }
);

Given(
  "{actor} is a guest who has finished today's last allowed puzzle",
  async (w, actor: Actor) => {
    await guestAfterStarts(w, actor, GUEST_DAILY_PUZZLE_STARTS);
    await w.s.apply(playUntilSolved, actor);
  }
);

Given(
  "{actor} is a guest who has been shown today's puzzle limit",
  async (w, actor: Actor) => {
    await guestAfterStarts(w, actor, GUEST_DAILY_PUZZLE_STARTS);
    await w.s.apply(playUntilSolved, actor);
    await w.s.apply(pressPuzzleNextNoWait, actor);
    await w.s.until((surf) => isPuzzleLimitVisible(surf, actor), {
      maxMs: SETTLE_MS,
    });
  }
);

When('{actor} asks for another puzzle', async (w, actor: Actor) => {
  await w.s.apply(pressPuzzleNextNoWait, actor);
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
