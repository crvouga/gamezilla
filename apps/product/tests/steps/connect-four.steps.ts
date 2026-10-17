import { CONNECT_FOUR_HARNESS_GAME } from '@libs/connect-four-harness/connect-four-harness-game';
import {
  observeGameJourney,
  playGameJourney,
} from '@libs/runtime-harness/game-journey';
import { Then, When } from './define';

When('the team checks Connect Four in this environment', async (w) => {
  w.memo.set(
    'connect-four-first',
    await playGameJourney(w.journey, CONNECT_FOUR_HARNESS_GAME)
  );
});
Then(
  'two people can find each other and complete Connect Four with the same result',
  async (w) => {
    const first = w.memo.get('connect-four-first');
    if (typeof first !== 'boolean')
      throw new Error('Connect Four did not start');
    await observeGameJourney(w.journey, CONNECT_FOUR_HARNESS_GAME, first);
  }
);
