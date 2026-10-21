// @io-wall-ok — a live Battleship game between two synthetic people.

import { expect } from 'bun:test';
import { BATTLESHIP_PLAYABLE } from '@libs/battleship-harness-ts/battleship-playable';
import { battleshipFleetsSeenBeyondShots } from '@libs/runtime-harness-ts/battleship-journey';
import {
  observeGameJourney,
  playGameJourney,
} from '@libs/runtime-harness-ts/game-journey';
import { Then, When } from './define';

When('the team checks Battleship in this environment', async (w) => {
  w.memo.set(
    'battleship-first',
    await playGameJourney(w.journey, BATTLESHIP_PLAYABLE)
  );
});
Then(
  'two people can find each other and play Battleship to a victory they both see',
  async (w) => {
    const first = w.memo.get('battleship-first');
    if (typeof first !== 'boolean') throw new Error('Battleship did not start');
    await observeGameJourney(w.journey, BATTLESHIP_PLAYABLE, first);
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
