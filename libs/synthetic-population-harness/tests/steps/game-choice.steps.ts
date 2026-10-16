import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness/define';
import {
  givenSyntheticGameChoice,
  startSyntheticActivity,
  syntheticGameChoice,
} from '@libs/synthetic-population-harness/game-choice-actions';

Given(
  'the Synthetic User {string} is ready to play {string}',
  async (w, name: string, game: string) => {
    await w.s.apply(givenSyntheticGameChoice, name);
    w.memo.set('synthetic-population:next-game', game);
  }
);
When('{string} starts its next activity', async (w, _name: string) => {
  await w.s.apply(
    startSyntheticActivity,
    w.memo.get('synthetic-population:next-game') as string
  );
});
Then(
  '{string} is looking for a multiplayer opponent for {string}',
  async (w, _name: string, game: string) => {
    expect(await w.s.read(syntheticGameChoice)).toEqual({
      chosenGame: game,
      seekingOpponent: true,
    });
  }
);
