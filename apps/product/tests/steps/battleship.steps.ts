// @io-wall-ok — a live Battleship game between two synthetic people.

import { expect } from 'bun:test';
import { BATTLESHIP_PLAYABLE } from '@libs/battleship-harness/battleship-playable';
import { battleshipFleetsSeenBeyondShots } from '@libs/runtime-harness/battleship-journey';
import {
  observeGameJourney,
  playedJourneyGame,
  playGameJourney,
} from '@libs/runtime-harness/game-journey';
import { Then, When } from './define';

When('the team checks Battleship in this environment', async (w) => {
  w.memo.set(
    'battleship-game',
    await playGameJourney(w.journey, BATTLESHIP_PLAYABLE)
  );
});
Then(
  'two people can find each other and play Battleship to a victory they both see',
  async (w) => {
    await observeGameJourney(
      w.journey,
      BATTLESHIP_PLAYABLE,
      playedJourneyGame(w.memo.get('battleship-game'), 'Battleship')
    );
  }
);
Then(
  "neither person saw the other's fleet beyond what their shots showed",
  async (w) => {
    expect(await battleshipFleetsSeenBeyondShots(w.journey)).toEqual({
      host: 0,
      guest: 0,
    });
  }
);
