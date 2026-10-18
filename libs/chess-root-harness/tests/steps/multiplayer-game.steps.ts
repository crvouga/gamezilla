import { expect } from 'bun:test';
import {
  acceptedMoves,
  bothBoards,
  resignation,
  winner,
} from '@libs/game-matchmaking-harness/matched-game-world';
import { Given, Then, When } from '@libs/harness/define';
import { accountIdOf } from '@libs/harness/identity';
import type { Actor } from '@libs/harness/parameter-types';
import { givenBegunGame, givenGame, playOnOwnBoard } from './multiplayer-world';

Given(
  '{actor} is White and {actor} is Black in a {word} multiplayer game after e4 and e5',
  givenBegunGame
);
Given(
  '{actor} is White and {actor} is Black after multiplayer moves f3, e5, g4',
  async (w, a: Actor, b: Actor) => {
    await givenGame(w, a, b);
    await acceptedMoves(w, ['f2f3', 'e7e5', 'g2g4']);
  }
);
When(
  '{actor} plays {word} to {word} as a multiplayer move',
  async (w, actor: Actor, from: string, to: string) => {
    await playOnOwnBoard(w, actor, from + to);
  }
);
When('{actor} resigns multiplayer chess', async (w, actor: Actor) => {
  await resignation(w, actor);
});

Then('{actor} has the multiplayer turn', async (w, actor: Actor) => {
  const owner = await w.s.read(accountIdOf, actor);
  expect((await bothBoards(w)).turn).toBe(owner!);
});

Then('both multiplayer boards still show two moves', async (w) => {
  expect((await bothBoards(w)).revision).toBe(2);
});

Then(
  'both people see {actor} won the multiplayer game by checkmate',
  (w, actor: Actor) => winner(w, actor, 'checkmate')
);
