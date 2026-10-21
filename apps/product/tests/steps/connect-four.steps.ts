import { CONNECT_FOUR_PLAYABLE } from '@libs/connect-four-harness/connect-four-playable';
import {
  observeGameJourney,
  playedJourneyGame,
  playGameJourney,
} from '@libs/runtime-harness/game-journey';
import { Then, When } from './define';

When('the team checks Connect Four in this environment', async (w) => {
  w.memo.set(
    'connect-four-game',
    await playGameJourney(w.journey, CONNECT_FOUR_PLAYABLE)
  );
});
Then(
  'two people can find each other and complete Connect Four with the same result',
  async (w) => {
    await observeGameJourney(
      w.journey,
      CONNECT_FOUR_PLAYABLE,
      playedJourneyGame(w.memo.get('connect-four-game'), 'Connect Four')
    );
  }
);
