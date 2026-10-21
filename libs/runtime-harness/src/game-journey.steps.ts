import { BATTLESHIP_PLAYABLE } from '@libs/battleship-harness/battleship-playable';
import { CONNECT_FOUR_PLAYABLE } from '@libs/connect-four-harness/connect-four-playable';
import { stepsFor } from '@pkgs/gherkin-shared/registry';
import {
  observeGameJourney,
  playedJourneyGame,
  playGameJourney,
} from './game-journey';
import type { JourneyWorld } from './journey-types';

const { When, Then } = stepsFor<
  JourneyWorld & { readonly memo: Map<string, unknown> }
>();
When('Alice and Bob play Connect Four from fresh devices', async (w) => {
  w.memo.set(
    'connect-four-game',
    await playGameJourney(w.journey, CONNECT_FOUR_PLAYABLE)
  );
});
Then('Alice and Bob see the same completed Connect Four game', async (w) => {
  await observeGameJourney(
    w.journey,
    CONNECT_FOUR_PLAYABLE,
    playedJourneyGame(w.memo.get('connect-four-game'), 'Connect Four')
  );
});
When('Alice and Bob play Battleship from fresh devices', async (w) => {
  w.memo.set(
    'battleship-game',
    await playGameJourney(w.journey, BATTLESHIP_PLAYABLE)
  );
});
Then('Alice and Bob see the same completed Battleship game', async (w) => {
  await observeGameJourney(
    w.journey,
    BATTLESHIP_PLAYABLE,
    playedJourneyGame(w.memo.get('battleship-game'), 'Battleship')
  );
});
