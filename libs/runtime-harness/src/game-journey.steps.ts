import { CONNECT_FOUR_HARNESS_GAME } from '@libs/connect-four-harness/connect-four-harness-game';
import { stepsFor } from '@pkgs/gherkin-shared/registry';
import { observeGameJourney, playGameJourney } from './game-journey';
import type { JourneyWorld } from './journey-types';

const { When, Then } = stepsFor<
  JourneyWorld & { readonly memo: Map<string, unknown> }
>();
When('Alice and Bob play Connect Four from fresh devices', async (w) => {
  w.memo.set(
    'connect-four-first',
    await playGameJourney(w.journey, CONNECT_FOUR_HARNESS_GAME)
  );
});
Then('Alice and Bob see the same completed Connect Four game', async (w) => {
  const first = w.memo.get('connect-four-first');
  if (typeof first !== 'boolean') throw new Error('Connect Four did not start');
  await observeGameJourney(w.journey, CONNECT_FOUR_HARNESS_GAME, first);
});
