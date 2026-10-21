/**
 * A clock that is low on time: shown so to both people and every watcher,
 * told to a person listening to the app with the side named as the game
 * names it, and sounded once as the low on time warning to its own person.
 */

import { expect } from 'bun:test';
import { givenMultiplayerClock } from '@libs/game-matchmaking-harness-ts/matched-game-fixtures';
import {
  acceptedMoves,
  bothBoards,
  matchedGameOf,
  pairOf,
  viewerOf,
} from '@libs/game-matchmaking-harness-ts/matched-game-world';
import { joinMultiplayerSpace } from '@libs/game-matchmaking-harness-ts/multiplayer-board';
import {
  lowOnTimeWarningsHeard,
  shownMultiplayerClockLow,
} from '@libs/game-matchmaking-harness-ts/multiplayer-low-on-time';
import { shownMultiplayerText } from '@libs/game-matchmaking-harness-ts/multiplayer-reads';
import { passMultiplayerTime } from '@libs/game-matchmaking-harness-ts/multiplayer-time';
import { openFindingAnOpponent } from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import { lowOnTimeLimitMs } from '@libs/game-matchmaking-shared-ts/multiplayer-clock';
import { Given, Then } from '@libs/harness-ts/define';
import { readSoundsOn } from '@libs/harness-ts/sounds-preference';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { gameOf } from './game-world';
import {
  firstMoves,
  pairedAt,
  timeControlFor,
  victoryMoveAt,
} from './matched-game';

const SECOND_MS = 1000;

const heardKey = (actor: string) => `matched-game:warnings-heard:${actor}`;

function open(w: HarnessWorld, device: string) {
  return w.s.apply(openFindingAnOpponent, device, gameOf(w).shared.id);
}

/** The first side's clock on `person`'s screen, shown low on time or not. */
async function firstClockSeen(w: HarnessWorld, person: string, low: boolean) {
  const device = viewerOf(w, person);
  await open(w, device);
  await w.s.until((s) => shownMultiplayerClockLow(s, device, 'white'), {
    pred: (shown) => shown === low,
    maxMs: 500,
  });
  expect(await w.s.read(shownMultiplayerClockLow, device, 'white')).toBe(low);
}

async function bothSeeFirstClock(w: HarnessWorld, low: boolean) {
  for (const person of pairOf(w)) await firstClockSeen(w, person, low);
}

/** Low on time warnings the device has sounded since the scenario's setup. */
async function newWarnings(w: HarnessWorld, actor: string) {
  await open(w, actor);
  const before = Number(w.memo.get(heardKey(actor)) ?? 0);
  return (await w.s.read(lowOnTimeWarningsHeard, actor)) - before;
}

/** How the game names its first side to a person. */
function firstSideName(w: HarnessWorld): string {
  const presentation = gameOf(w).client.presentation;
  if (presentation === undefined)
    throw new Error(`${gameOf(w).label} has no board to name its sides`);
  return presentation.sideLabel('white');
}

Given(
  "{actor} is a guest watching {actor}'s matched game",
  async (w, watcher: string, host: string) => {
    await open(w, host);
    await w.s.apply(joinMultiplayerSpace, watcher, host);
  }
);
Given(
  '{actor} is listening to her {word} matched game with {actor} after their first moves',
  async (w, first: string, clock: string, second: string) => {
    await pairedAt(w, first, second, clock);
    await firstMoves(w);
    await open(w, first);
  }
);
// She watched her clock become low on time once, moved, and is to move again.
Given(
  "{actor}'s clock was low on time earlier in her {word} matched game with {actor}, and she has the first side with {int} seconds left on her turn",
  async (
    w,
    ...[first, clock, second, seconds]: [string, string, string, number]
  ) => {
    await pairedAt(w, first, second, clock);
    await firstMoves(w);
    await open(w, first);
    const game = await matchedGameOf(w, first);
    const low = lowOnTimeLimitMs(timeControlFor(w, clock));
    await w.s.apply(givenMultiplayerClock, first, {
      gameId: game.id,
      side: 'white',
      ms: low + SECOND_MS,
    });
    await w.s.apply(passMultiplayerTime, SECOND_MS);
    await w.s.until((s) => lowOnTimeWarningsHeard(s, first), {
      pred: (heard) => heard === 1,
      maxMs: 500,
    });
    await acceptedMoves(w, [victoryMoveAt(w, 2), victoryMoveAt(w, 3)]);
    await w.s.apply(givenMultiplayerClock, first, {
      gameId: game.id,
      side: 'white',
      ms: seconds * SECOND_MS,
    });
    await bothBoards(w, (g) => g.white_ms === seconds * SECOND_MS);
    w.memo.set(heardKey(first), await w.s.read(lowOnTimeWarningsHeard, first));
  }
);

Then("both people see the first side's clock is low on time", (w) =>
  bothSeeFirstClock(w, true)
);
Then("both people see the first side's clock is not low on time", (w) =>
  bothSeeFirstClock(w, false)
);
Then("{actor} sees the first side's clock is low on time", (w, actor: string) =>
  firstClockSeen(w, actor, true)
);
Then(
  "{actor} hears the first side's clock is low on time with {int} seconds left",
  async (w, actor: string, seconds: number) => {
    const phrase = `${firstSideName(w)} is low on time, with ${String(seconds)} seconds left.`;
    await w.s.until(
      (s) => shownMultiplayerText(s, actor, 'multiplayer-announcement'),
      { pred: (heard) => (heard ?? '').includes(phrase), maxMs: 500 }
    );
    expect(
      await w.s.read(shownMultiplayerText, actor, 'multiplayer-announcement')
    ).toContain(phrase);
  }
);
Then('{actor} hears the low on time warning', async (w, actor: string) => {
  await open(w, actor);
  await w.s.until((s) => lowOnTimeWarningsHeard(s, actor), {
    pred: (heard) => heard > 0,
    maxMs: 500,
  });
  expect(await w.s.read(lowOnTimeWarningsHeard, actor)).toBe(1);
});
Then('{actor} hears no new low on time warning', async (w, actor: string) => {
  expect(await newWarnings(w, actor)).toBe(0);
});
Then(
  "{actor} cannot hear the low on time warning while the app's sounds are off",
  async (w, actor: string) => {
    expect(await w.s.read(readSoundsOn, actor)).toBe(false);
    expect(await newWarnings(w, actor)).toBe(0);
  }
);
