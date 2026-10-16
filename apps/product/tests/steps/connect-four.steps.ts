import {
  observeConnectFourJourney,
  playConnectFourJourney,
} from '@libs/runtime-harness/connect-four-journey';
import { Then, When } from './define';

When('the team checks Connect Four in this environment', async (w) => {
  w.memo.set('connect-four-first', await playConnectFourJourney(w.journey));
});
Then(
  'two people can find each other and complete Connect Four with the same result',
  async (w) => {
    const first = w.memo.get('connect-four-first');
    if (typeof first !== 'boolean')
      throw new Error('Connect Four did not start');
    await observeConnectFourJourney(w.journey, first);
  }
);
