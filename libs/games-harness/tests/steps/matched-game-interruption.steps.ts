/**
 * A matched game whose play is interrupted for everyone, whichever game it
 * is: its clocks pause and spend nothing at any speed, moves and
 * resignations are refused, and resuming keeps its board, the time that
 * remained and one rated result.
 */

import { expect } from 'bun:test';
import {
  bothBoards,
  matchedGameOf,
  pairOf,
  resignation,
} from '@libs/game-matchmaking-harness/matched-game-world';
import {
  clockChoiceOfSpeed,
  multiplayerCanLeave,
  multiplayerClockSeconds,
  multiplayerPauseShown,
  setMultiplayerAvailability,
} from '@libs/game-matchmaking-harness/multiplayer-availability';
import { givenMultiplayerClock } from '@libs/game-matchmaking-harness/multiplayer-fixtures';
import { passMultiplayerDays } from '@libs/game-matchmaking-harness/multiplayer-time';
import { openFindingAnOpponent } from '@libs/game-matchmaking-harness/opponent-seeking';
import { Given, Then, When } from '@libs/harness/define';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { gameOf } from './game-world';
import { firstMoves, pairedAt, told } from './matched-game';
import { deviceOffline } from './matched-game-connection';

const SECOND_MS = 1000;
const PAUSE_CLOCKS = 'matched-game:pause-clocks';

/** Play becomes unavailable, or available again, for both people. */
async function availability(w: HarnessWorld, available: boolean) {
  const [first] = pairOf(w);
  const game = await matchedGameOf(w, first);
  await w.s.apply(setMultiplayerAvailability, first, game.id, available);
  await bothBoards(w, (seen) => (seen.paused_at_ms === null) === available);
  w.memo.set('multiplayer:game', await matchedGameOf(w, first));
}

async function pause(w: HarnessWorld) {
  w.memo.set(
    PAUSE_CLOCKS,
    await w.s.read(multiplayerClockSeconds, pairOf(w)[0])
  );
  await availability(w, false);
}

/** `first` and `second`'s matched game at `clock`, after their first moves. */
async function begun(
  w: HarnessWorld,
  people: readonly [string, string],
  clock: string
) {
  await pairedAt(w, people[0], people[1], clock);
  await firstMoves(w);
}

Given(
  '{actor} and {actor} have an unfinished {word} matched game after their first moves',
  async (w, first: string, second: string, speed: string) => {
    await begun(w, [first, second], clockChoiceOfSpeed(speed));
  }
);
Given('their clocks are paused', pause);
Given(
  '{actor} and {actor} have a {word} matched game after their first moves with their clocks paused',
  async (w, first: string, second: string, clock: string) => {
    await begun(w, [first, second], clock);
    await pause(w);
  }
);
Given(
  '{actor} and {actor} have resumed their {word} matched game after their first moves',
  async (w, first: string, second: string, clock: string) => {
    await begun(w, [first, second], clock);
    await pause(w);
    await availability(w, true);
  }
);
Given(
  "{actor} and {actor}'s {word} matched game after their first moves has resumed with {int} seconds left for the first side",
  async (
    w,
    ...[first, second, clock, seconds]: [string, string, string, number]
  ) => {
    await begun(w, [first, second], clock);
    await w.s.apply(givenMultiplayerClock, first, {
      gameId: (await matchedGameOf(w, first)).id,
      side: 'white',
      ms: seconds * SECOND_MS,
    });
    await pause(w);
    await availability(w, true);
  }
);
Given(
  '{actor} resigned the matched game before {actor} heard the result',
  async (w, resigner: string, winner: string) => {
    await begun(w, [winner, resigner], '5+0');
    await deviceOffline(w, winner);
    expect((await resignation(w, resigner)).result.ok).toBe(true);
  }
);
Given(
  "both people's devices were offline for {int} seconds while their clocks kept running",
  async (w, seconds: number) => {
    for (const person of pairOf(w)) await deviceOffline(w, person);
    await w.s.apply(passMultiplayerDays, seconds * SECOND_MS);
  }
);

When('their clocks resume', (w) => availability(w, true));

Then('both people keep the same time on their clocks', async (w) => {
  for (const person of pairOf(w))
    expect(await w.s.read(multiplayerClockSeconds, person)).toEqual(
      w.memo.get(PAUSE_CLOCKS) as Awaited<
        ReturnType<typeof multiplayerClockSeconds>
      >
    );
});
Then('{actor} is told the matched game is paused', (w, actor: string) =>
  told(w, actor, 'CHESS_PLAY_UNAVAILABLE')
);
Then(
  '{actor} is told the clocks are paused within {int} seconds',
  async (w, actor: string, seconds: number) => {
    await w.s.until((s) => multiplayerPauseShown(s, actor), {
      maxMs: seconds * SECOND_MS,
    });
  }
);
Then("{actor} can go back to the game's choices", async (w, actor: string) => {
  expect(await w.s.read(multiplayerCanLeave, actor)).toBe(true);
});
Then(
  "{actor} sees {int} seconds left on the first side's clock",
  async (w, actor: string, seconds: number) => {
    await w.s.apply(openFindingAnOpponent, actor, gameOf(w).shared.id);
    expect((await w.s.read(multiplayerClockSeconds, actor)).white).toBe(
      seconds
    );
  }
);
