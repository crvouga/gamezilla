import { BATTLESHIP_PLAYABLE } from '@libs/battleship-harness/battleship-playable';
import { CONNECT_FOUR_PLAYABLE } from '@libs/connect-four-harness/connect-four-playable';
import { stepsFor } from '@pkgs/gherkin-shared/registry';
import { observeGameJourney, playGameJourney } from './game-journey';
import type { JourneyWorld } from './journey-types';

const { When, Then } = stepsFor<
  JourneyWorld & { readonly memo: Map<string, unknown> }
>();
When('Alice and Bob play Connect Four from fresh devices', async (w) => {
  w.memo.set(
    'connect-four-first',
    await playGameJourney(w.journey, CONNECT_FOUR_PLAYABLE)
  );
});
Then('Alice and Bob see the same completed Connect Four game', async (w) => {
  const first = w.memo.get('connect-four-first');
  if (typeof first !== 'boolean') throw new Error('Connect Four did not start');
  await observeGameJourney(w.journey, CONNECT_FOUR_PLAYABLE, first);
});
When('Alice and Bob play Battleship from fresh devices', async (w) => {
  w.memo.set(
    'battleship-first',
    await playGameJourney(w.journey, BATTLESHIP_PLAYABLE)
  );
});
Then('Alice and Bob see the same completed Battleship game', async (w) => {
  const first = w.memo.get('battleship-first');
  if (typeof first !== 'boolean') throw new Error('Battleship did not start');
  await observeGameJourney(w.journey, BATTLESHIP_PLAYABLE, first);
});
