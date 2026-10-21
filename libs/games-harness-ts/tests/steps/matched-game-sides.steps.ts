/**
 * Sides shared out by side balance: each person's earlier matched games of
 * the run's game, finished with a result, decide who gets the second side.
 */

import { searchFor } from '@libs/game-matchmaking-harness-ts/matched-game-world';
import { Given } from '@libs/harness-ts/define';
import { finishedAt, readyPeople, timeControlFor } from './matched-game';

const SECOND_MS = 1000;

Given(
  '{actor} had the first side and {actor} the second side in their only matched games',
  (w, first: string, second: string) => finishedAt(w, first, second, '5+0')
);
Given(
  '{actor} had the first side in her only matched game and {actor} has had none',
  async (w, first: string, newcomer: string) => {
    await finishedAt(w, first, 'carol', '5+0');
    await readyPeople(w, [newcomer]);
  }
);
Given(
  '{actor} and {actor} each had the first side in their only matched game',
  async (w, first: string, second: string) => {
    await finishedAt(w, first, 'carol', '5+0');
    await finishedAt(w, second, 'dave', '5+0');
  }
);
Given(
  '{actor} began seeking an opponent for the game at {word} before {actor} did',
  async (w, first: string, clock: string, second: string) => {
    await searchFor(w, first, timeControlFor(w, clock));
    await w.s.advanceTime(SECOND_MS);
    await searchFor(w, second, timeControlFor(w, clock));
  }
);
