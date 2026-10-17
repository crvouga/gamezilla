import { expect } from 'bun:test';
import { openMultiplayerChess } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import {
  lowOnTimeWarningsHeard,
  shownMultiplayerClockLow,
} from '@libs/chess-matchmaking-harness/multiplayer-low-on-time';
import { readPuzzleSoundsOn } from '@libs/chess-puzzle-harness/puzzle-sound-preference';
import {
  acceptedMoves,
  bothBoards,
  matchedGameOf,
  pairOf,
  viewerOf,
} from '@libs/game-matchmaking-harness/matched-game-world';
import { givenMultiplayerClock } from '@libs/game-matchmaking-harness/multiplayer-fixtures';
import { shownMultiplayerText } from '@libs/game-matchmaking-harness/multiplayer-reads';
import { passMultiplayerTime } from '@libs/game-matchmaking-harness/multiplayer-time';
import { Given, Then } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { givenBegunGame } from './multiplayer-world';

const SECOND_MS = 1000;
/** A bullet multiplayer clock is low on time with this many seconds left. */
const BULLET_LOW_SECONDS = 10;

const heardKey = (actor: string) => `multiplayer:warnings-heard:${actor}`;

/** White's clock on the person's multiplayer screen, shown low on time or not. */
async function whiteClockSeen(w: HarnessWorld, person: string, low: boolean) {
  const actor = viewerOf(w, person);
  await w.s.apply(openMultiplayerChess, actor);
  await w.s.until((s) => shownMultiplayerClockLow(s, actor, 'white'), {
    pred: (shown) => shown === low,
    maxMs: 500,
  });
  expect(await w.s.read(shownMultiplayerClockLow, actor, 'white')).toBe(low);
}

async function bothSeeWhiteClock(w: HarnessWorld, low: boolean) {
  for (const person of pairOf(w)) await whiteClockSeen(w, person, low);
}

/** Low on time warnings the device has sounded since the scenario's setup. */
async function newWarnings(w: HarnessWorld, actor: string) {
  await w.s.apply(openMultiplayerChess, actor);
  const before = Number(w.memo.get(heardKey(actor)) ?? 0);
  return (await w.s.read(lowOnTimeWarningsHeard, actor)) - before;
}

Then("both people see White's multiplayer clock is low on time", (w) =>
  bothSeeWhiteClock(w, true)
);
Then("both people see White's multiplayer clock is not low on time", (w) =>
  bothSeeWhiteClock(w, false)
);
Then(
  "{actor} sees White's multiplayer clock is low on time",
  (w, actor: Actor) => whiteClockSeen(w, actor, true)
);
Then(
  "{actor} hears White's multiplayer clock is low on time with {int} seconds left",
  async (w, actor: Actor, seconds: number) => {
    const phrase = `White is low on time, with ${String(seconds)} seconds left.`;
    await w.s.until(
      (s) => shownMultiplayerText(s, actor, 'multiplayer-announcement'),
      { pred: (heard) => (heard ?? '').includes(phrase), maxMs: 500 }
    );
    expect(
      await w.s.read(shownMultiplayerText, actor, 'multiplayer-announcement')
    ).toContain(phrase);
  }
);

Then('{actor} hears the low on time warning', async (w, actor: Actor) => {
  await w.s.apply(openMultiplayerChess, actor);
  await w.s.until((s) => lowOnTimeWarningsHeard(s, actor), {
    pred: (heard) => heard > 0,
    maxMs: 500,
  });
  expect(await w.s.read(lowOnTimeWarningsHeard, actor)).toBe(1);
});
Then('{actor} hears no new low on time warning', async (w, actor: Actor) => {
  expect(await newWarnings(w, actor)).toBe(0);
});
Then(
  "{actor} cannot hear the low on time warning while the app's sounds are off",
  async (w, actor: Actor) => {
    expect(await w.s.read(readPuzzleSoundsOn, actor)).toBe(false);
    expect(await newWarnings(w, actor)).toBe(0);
  }
);

// She watched her clock become low on time once, moved, and is to move again.
Given(
  "{actor}'s multiplayer clock was low on time earlier in her {word} multiplayer game with {actor}, and she is White with {int} seconds left on her turn",
  async (
    w,
    ...[white, timeControl, black, seconds]: [Actor, string, Actor, number]
  ) => {
    await givenBegunGame(w, white, black, timeControl);
    await w.s.apply(openMultiplayerChess, white);
    const game = await matchedGameOf(w, white);
    await w.s.apply(givenMultiplayerClock, white, {
      gameId: game.id,
      side: 'white',
      ms: (BULLET_LOW_SECONDS + 1) * SECOND_MS,
    });
    await w.s.apply(passMultiplayerTime, SECOND_MS);
    await w.s.until((s) => lowOnTimeWarningsHeard(s, white), {
      pred: (heard) => heard === 1,
      maxMs: 500,
    });
    await acceptedMoves(w, ['g1f3', 'b8c6']);
    await w.s.apply(givenMultiplayerClock, white, {
      gameId: game.id,
      side: 'white',
      ms: seconds * SECOND_MS,
    });
    await bothBoards(w, (g) => g.white_ms === seconds * SECOND_MS);
    w.memo.set(heardKey(white), await w.s.read(lowOnTimeWarningsHeard, white));
  }
);
