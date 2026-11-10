import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness-ts/define';
import {
  givenSyntheticGameChoice,
  startSyntheticActivity,
  syntheticGameChoice,
} from '@libs/synthetic-population-harness-ts/game-choice-actions';

Given(
  'the Synthetic User {string} is ready to play {string}',
  async (w, name: string, game: string) => {
    await w.s.apply(givenSyntheticGameChoice, name);
    w.memo.set('synthetic-population:next-game', game);
  }
);
When('{string} starts its next activity', async (w, name: string) => {
  await w.s.apply(
    startSyntheticActivity,
    w.memo.get('synthetic-population:next-game') as string,
    name
  );
});
Then(
  '{string} is looking for a multiplayer opponent for {string}',
  async (w, name: string, game: string) => {
    expect(await w.s.read(syntheticGameChoice, name)).toEqual({
      chosenGame: game,
      seekingOpponent: true,
    });
  }
);
