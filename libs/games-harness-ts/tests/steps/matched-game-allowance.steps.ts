/**
 * The daily matched game limit at the run's game: a guest's matched games
 * started today, of this game or another, count toward one allowance; past
 * it seeking an opponent is refused with an invitation to sign in, and a new
 * day or an account lifts it. The decision table holds every case
 * (`tests/dmn/daily-matched-game-limit.binding.ts`); these are its examples
 * on the screen a person uses.
 */

import { expect } from 'bun:test';
import { multiplayerRefusalCode } from '@libs/game-matchmaking-harness-ts/multiplayer-commands';
import {
  findOffered,
  matchedGamesLeftShown,
} from '@libs/game-matchmaking-harness-ts/multiplayer-reads';
import { stopSeekingOpponent } from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import {
  givenStartedMatchedGames,
  startOfToday,
} from '@libs/game-matchmaking-harness-ts/started-matched-games';
import type { HarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { Given, Then } from '@libs/harness-ts/define';
import { type HarnessWorld, rememberGuest } from '@libs/harness-ts/spec-world';
import { notWaiting, seeking } from './finding-an-opponent-world';
import { anotherGame, gameOf } from './game-world';
import { actingDevice, readyPeople } from './matched-game';

/** `count` matched games of `game` started at `atMs`, all of them over. */
async function started(
  w: HarnessWorld,
  actor: string,
  game: HarnessGame,
  args: { readonly count: number; readonly atMs: number }
): Promise<void> {
  await readyPeople(w, [actor]);
  await w.s.apply(givenStartedMatchedGames, actor, {
    count: args.count,
    fen: game.shared.registration.rules.initial(),
    atMs: args.atMs,
  });
}

/** The first instant of today: started then, a game counts toward today. */
async function today(w: HarnessWorld): Promise<number> {
  return w.s.read(startOfToday);
}

Given(
  '{actor} is a guest who has started {int} matched games today',
  async (w, actor: string, count: number) => {
    rememberGuest(w, actor);
    await started(w, actor, gameOf(w), { count, atMs: await today(w) });
  }
);
Given(
  '{actor} is a guest who has started {int} matched games of another game today',
  async (w, actor: string, count: number) => {
    rememberGuest(w, actor);
    await started(w, actor, anotherGame(w, 'matchmaking'), {
      count,
      atMs: await today(w),
    });
  }
);
// The last instant of yesterday: one millisecond earlier would be today.
Given(
  '{actor} is a guest who started {int} matched games before today',
  async (w, actor: string, count: number) => {
    rememberGuest(w, actor);
    await started(w, actor, gameOf(w), {
      count,
      atMs: (await today(w)) - 1,
    });
  }
);
Given(
  '{actor} has a free account that started {int} matched games today',
  async (w, actor: string, count: number) => {
    await started(w, actor, gameOf(w), { count, atMs: await today(w) });
  }
);

Then(
  "{actor} is told no new matched game can start because today's matched game allowance is used",
  async (w, actor: string) => {
    // The server decides the allowance, so its refusal arrives after the seek.
    expect(
      await w.s.until(
        (s) => multiplayerRefusalCode(s, actingDevice(w, actor)),
        { pred: (code) => code !== null }
      )
    ).toBe('quota_exhausted');
  }
);

Given('{actor} has stopped seeking an opponent', async (w, actor: string) => {
  await seeking(w, actor);
  await w.s.apply(stopSeekingOpponent, actor);
  // Precondition guard: the search is over.
  await notWaiting(w, actor);
});

Then(
  '{actor} can read that {int} matched games remain today',
  async (w, actor: string, left: number) => {
    expect(
      await w.s.until((s) => matchedGamesLeftShown(s, actor), {
        pred: (shown) => shown !== null,
      })
    ).toBe(left);
  }
);
Then(
  '{actor} is not shown how many matched games remain today',
  async (w, actor: string) => {
    // The hub has opened: its find command is there to be pressed.
    await w.s.until((s) => findOffered(s, actor), { pred: Boolean });
    expect(await w.s.read(matchedGamesLeftShown, actor)).toBeNull();
  }
);
