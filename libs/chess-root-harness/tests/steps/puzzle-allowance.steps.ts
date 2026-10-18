/**
 * The daily rated-puzzle allowance as a chess puzzle link meets it: a guest
 * who has started some of today's rated puzzles, or finished the last one
 * allowed, and what the allowance then says. How every game's puzzles meet
 * the allowance is the Games context's (`@libs/games-harness` puzzle
 * steps); the ledger rules are in
 * `libs/permissions-shared/tests/consume-quota.test.ts`.
 */

import { expect } from 'bun:test';
import { playUntilSolved } from '@libs/chess-puzzle-harness/chess-actions';
import { useUpPuzzleStartsToday } from '@libs/game-session-harness/puzzle-allowance';
import {
  isPuzzleLimitShown,
  readPuzzleStartsLeft,
} from '@libs/game-session-harness/puzzle-screen';
import { Given, Then } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { enterPuzzles, SECOND_MS, SETTLE_MS } from './puzzle-world';

/** The shipped policy's rated puzzle starts a guest gets per day (GOAL). */
const GUEST_DAILY_PUZZLE_STARTS = 20;

/** `starts` puzzles played today, this one included and solved. */
async function playedToday(w: HarnessWorld, actor: Actor, starts: number) {
  await enterPuzzles(w, actor);
  await w.s.apply(useUpPuzzleStartsToday, actor, starts);
  await w.s.apply(playUntilSolved, actor);
}

Given(
  '{actor} is a guest who has played {int} puzzles today',
  async (w, actor: Actor, played: number) => {
    await playedToday(w, actor, played);
  }
);

Given(
  "{actor} is a guest who has finished today's last allowed puzzle",
  async (w, actor: Actor) => {
    await playedToday(w, actor, GUEST_DAILY_PUZZLE_STARTS);
  }
);

Then(
  "{actor} is told no new puzzle can start because today's allowance is used within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    await w.s.until((surf) => isPuzzleLimitShown(surf, actor), {
      maxMs: seconds * SECOND_MS,
    });
  }
);

Then(
  '{actor} can read that {int} rated puzzles remain today',
  async (w, actor: Actor, remaining: number) => {
    const shown = await w.s.until((s) => readPuzzleStartsLeft(s, actor), {
      pred: (value) => value === remaining,
      maxMs: SETTLE_MS,
    });
    expect(shown).toBe(remaining);
  }
);
