import { expect } from 'bun:test';
import {
  readCustomGameSeconds,
  readCustomGameTime,
} from '@libs/game-session-harness/custom-game-clocks';
import { customGameView } from '@libs/game-session-harness/custom-game-moves';
import type { CustomGameSide } from '@libs/game-session-shared/custom-game-state';
import { customGameTimeLeft } from '@libs/game-session-shared/custom-game-state';
import { Given, Then, When } from '@libs/harness/define';
import type { HarnessWorld } from '@libs/harness/spec-world';
import {
  choose,
  chosen,
  clockChoice,
  current,
  toldOf,
} from './custom-game-set-up-world';
import { hostOf, setupCustomGame, sideOf } from './game-world';

const SECOND_MS = 1000;

/** The seconds `side`'s clock shows the host. */
function secondsShown(w: HarnessWorld, side: CustomGameSide): Promise<number> {
  return w.s.read(readCustomGameSeconds, hostOf(w), side);
}

Given(
  '{actor} and {actor} have a custom game under way played at {word}',
  async (w, _first: string, _second: string, clock: string) =>
    setupCustomGame(w, { clock: clockChoice(clock) })
);
Given('{int} seconds have passed', async (w, seconds: number) =>
  w.s.advanceTime(seconds * SECOND_MS)
);
Given(
  '{actor} has chosen {word} for the custom game',
  async (w, actor: string, clock: string) =>
    chosen(w, actor, { operation: 'clock', ...clockChoice(clock) })
);
Given('the {gameSide} has run out of time', async (w, side: CustomGameSide) => {
  const game = await current(w);
  await w.s.advanceTime(
    customGameTimeLeft(game, side, await w.s.read(readCustomGameTime))
  );
});

When('{actor} chooses an untimed custom game', async (w, actor: string) =>
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
  async (w, side: CustomGameSide, seconds: number) => {
    expect(await secondsShown(w, side)).toBe(seconds);
  }
);
Then('{actor} wins the custom game on time', async (w, actor: string) => {
  const side = await sideOf(w, actor);
  const game = await w.s.until((s) => customGameView(s, hostOf(w)), {
    pred: (seen) => seen.current?.status === 'completed',
  });
  expect(game.current?.outcome).toBe(`${side} wins on time`);
});
Then(
  '{actor} is told that clock choice is not offered',
  async (w, actor: string) => toldOf(w, actor, 'invalid time choice')
);
