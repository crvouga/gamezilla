import {
  QUORIDOR_HILL_PLAYABLE,
  QUORIDOR_PLAYABLE,
} from '@libs/quoridor-harness-ts/quoridor-playable';
import {
  observeCustomGamePartyJourney,
  type PublicCustomGame,
  playCustomGamePartyJourney,
} from '@libs/runtime-harness-ts/custom-game-party-journey';
import {
  observeGameJourney,
  playGameJourney,
} from '@libs/runtime-harness-ts/game-journey';
import { Then, When } from './define';

When('the team checks Classic Quoridor in this environment', async (w) => {
  w.memo.set(
    'quoridor-first',
    await playGameJourney(w.journey, QUORIDOR_PLAYABLE)
  );
});
Then(
  'two people can find each other and complete Classic Quoridor with the same result',
  async (w) => {
    const first = w.memo.get('quoridor-first');
    if (typeof first !== 'boolean')
      throw new Error('Classic Quoridor did not start');
    await observeGameJourney(w.journey, QUORIDOR_PLAYABLE, first);
  }
);
When(
  'the team checks Four-Player King of the Hill in this environment',
  async (w) => {
    w.memo.set(
      'quoridor-hill-finished',
      await playCustomGamePartyJourney(w.journey, QUORIDOR_HILL_PLAYABLE)
    );
  }
);
Then(
  'two people and two bots can complete Four-Player King of the Hill with the same result',
  async (w) => {
    const finished = w.memo.get('quoridor-hill-finished') as
      | PublicCustomGame
      | undefined;
    if (finished === undefined)
      throw new Error('King of the Hill did not finish');
    await observeCustomGamePartyJourney(w.journey, finished);
  }
);
