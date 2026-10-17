import { expect } from 'bun:test';
import { openMultiplayerChess } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import {
  bothBoards,
  matchedGameOf,
  refusal,
  resignation,
} from '@libs/game-matchmaking-harness/matched-game-world';
import {
  multiplayerCanLeave,
  multiplayerClockSeconds,
  multiplayerPauseShown,
  SHARED_CLOCK_CONTROLS,
  setMultiplayerAvailability,
} from '@libs/game-matchmaking-harness/multiplayer-availability';
import { givenMultiplayerClock } from '@libs/game-matchmaking-harness/multiplayer-fixtures';
import { passMultiplayerDays } from '@libs/game-matchmaking-harness/multiplayer-time';
import { Given, Then, When } from '@libs/harness/define';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { disconnectMultiplayer } from './multiplayer-connection';
import { givenBegunGame } from './multiplayer-world';

async function availability(w: HarnessWorld, available: boolean) {
  const game = await matchedGameOf(w);
  await w.s.apply(setMultiplayerAvailability, 'alice', game.id, available);
  await bothBoards(w, (game) => (game.paused_at_ms === null) === available);
  w.memo.set('multiplayer:game', await matchedGameOf(w));
}

async function pause(w: HarnessWorld) {
  w.memo.set(
    'multiplayer:pause-clocks',
    await w.s.read(multiplayerClockSeconds, 'alice')
  );
  await availability(w, false);
}

async function pausedGame(w: HarnessWorld, control: string) {
  await givenBegunGame(w, 'alice', 'bob', control);
  await pause(w);
}

Given(
  'Alice and Bob have an unfinished {word} multiplayer game after both first moves',
  async (w, speed: string) => {
    const control = SHARED_CLOCK_CONTROLS[speed];
    if (control === undefined)
      throw new Error(`Unknown shared clock speed ${speed}`);
    await givenBegunGame(w, 'alice', 'bob', control);
  }
);
Given('their multiplayer clocks are paused', pause);
Given(
  'Alice and Bob have a {word} multiplayer game after e4 and e5 with their multiplayer clocks paused',
  pausedGame
);
Given(
  'Alice and Bob have resumed their {word} multiplayer game after e4 and e5',
  async (w, control: string) => {
    await pausedGame(w, control);
    await availability(w, true);
  }
);
Given(
  "Alice and Bob's {word} multiplayer game after e4 and e5 has resumed with {int} seconds left for White",
  async (w, control: string, seconds: number) => {
    await givenBegunGame(w, 'alice', 'bob', control);
    await w.s.apply(givenMultiplayerClock, 'alice', {
      gameId: (await matchedGameOf(w)).id,
      side: 'white',
      ms: seconds * 1000,
    });
    await pause(w);
    await availability(w, true);
  }
);
Given(
  'Bob resigned multiplayer chess before Alice heard the multiplayer result',
  async (w) => {
    await givenBegunGame(w);
    await disconnectMultiplayer(w, 'alice');
    expect((await resignation(w, 'bob')).result.ok).toBe(true);
  }
);
Given(
  "both people's devices were offline for {int} seconds while their multiplayer clocks kept running",
  async (w, seconds: number) => {
    await disconnectMultiplayer(w, 'alice');
    await disconnectMultiplayer(w, 'bob');
    await w.s.apply(passMultiplayerDays, seconds * 1000);
  }
);
When('their multiplayer clocks resume', (w) => availability(w, true));
Then(
  'both people keep the same time on their multiplayer clocks',
  async (w) => {
    for (const actor of ['alice', 'bob'])
      expect(await w.s.read(multiplayerClockSeconds, actor)).toEqual(
        w.memo.get('multiplayer:pause-clocks') as Awaited<
          ReturnType<typeof multiplayerClockSeconds>
        >
      );
  }
);
Then(
  '{actor} is told multiplayer chess is temporarily unavailable',
  (w, actor: string) => refusal(w, actor, 'CHESS_PLAY_UNAVAILABLE')
);
Then(
  '{actor} is told the multiplayer clocks are paused within {int} seconds',
  async (w, actor: string, seconds: number) => {
    await w.s.until((s) => multiplayerPauseShown(s, actor), {
      maxMs: seconds * 1000,
    });
  }
);
Then('{actor} can leave the multiplayer board', async (w, actor: string) => {
  expect(await w.s.read(multiplayerCanLeave, actor)).toBe(true);
});
Then(
  "{actor} sees {int} seconds left on White's multiplayer clock",
  async (w, actor: string, seconds: number) => {
    await w.s.apply(openMultiplayerChess, actor);
    expect((await w.s.read(multiplayerClockSeconds, actor)).white).toBe(
      seconds
    );
  }
);
