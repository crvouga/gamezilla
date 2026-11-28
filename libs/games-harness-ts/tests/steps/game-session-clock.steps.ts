import { expect } from 'bun:test';
import {
  inMatchedGame,
  matchedGameOf,
  pairOf,
} from '@libs/game-matchmaking-harness-ts/matched-game-world';
import { passMultiplayerTime } from '@libs/game-matchmaking-harness-ts/multiplayer-time';
import { clockLeftMs } from '@libs/game-matchmaking-shared-ts/multiplayer-clock';
import {
  readGameSessionSeconds,
  readGameSessionTime,
} from '@libs/game-session-harness-ts/game-session-clocks';
import { gameSessionView } from '@libs/game-session-harness-ts/game-session-probe';
import type { GameSessionSide } from '@libs/game-session-shared-ts/game-session-state';
import { gameSessionTimeLeft } from '@libs/game-session-shared-ts/game-session-state';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import {
  choose,
  chosen,
  clockChoice,
  current,
  toldOf,
} from './game-session-set-up-world';
import { hostOf, setupGameSession, sideOf } from './game-world';

const SECOND_MS = 1000;

/** The seconds `side`'s clock shows the host. */
function secondsShown(w: HarnessWorld, side: GameSessionSide): Promise<number> {
  return w.s.read(readGameSessionSeconds, hostOf(w), side);
}

Given(
  '{actor} and {actor} have a game session under way played at {word}',
  async (w, _first: string, _second: string, clock: string) =>
    setupGameSession(w, { clock: clockChoice(clock) })
);
Given('{int} seconds have passed', async (w, seconds: number) =>
  w.s.advanceTime(seconds * SECOND_MS)
);
Given(
  '{actor} has chosen {word} for the game session',
  async (w, actor: string, clock: string) =>
    chosen(w, actor, { operation: 'clock', ...clockChoice(clock) })
);
// A game session's clock, or the matched game's: the side's time passes.
Given(
  'the {gameSide} has run out of time',
  async (w, side: GameSessionSide) => {
    if (inMatchedGame(w)) {
      const game = await matchedGameOf(w, pairOf(w)[0]);
      const now = await w.s.read((s) => s.harness.clock.now());
      await w.s.apply(passMultiplayerTime, clockLeftMs(game, side, now));
      return;
    }
    const game = await current(w);
    await w.s.advanceTime(
      gameSessionTimeLeft(game, side, await w.s.read(readGameSessionTime))
    );
  }
);

When('{actor} chooses an untimed game session', async (w, actor: string) =>
  choose(w, actor, { operation: 'untimed' })
);

Then(
  'the first side has {int} seconds and the second side has {int} seconds',
  async (w, first: number, second: number) => {
    expect(await secondsShown(w, 'white')).toBe(first);
    expect(await secondsShown(w, 'black')).toBe(second);
  }
);
Then(
  'the {gameSide} has {int} seconds',
  async (w, side: GameSessionSide, seconds: number) => {
    expect(await secondsShown(w, side)).toBe(seconds);
  }
);
Then('{actor} wins the game session on time', async (w, actor: string) => {
  const side = await sideOf(w, actor);
  const game = await w.s.until((s) => gameSessionView(s, hostOf(w)), {
    pred: (seen) => seen.current?.status === 'completed',
  });
  expect(game.current?.outcome).toBe(`${side} wins on time`);
});
Then(
  '{actor} is told that clock choice is not offered',
  async (w, actor: string) => toldOf(w, actor, 'invalid time choice')
);
