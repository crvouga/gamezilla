import { expect } from 'bun:test';
import { Given, Then } from '@libs/harness-ts/define';
import {
  givenSyntheticGameChoice,
  startSyntheticActivity,
} from '@libs/synthetic-population-harness-ts/game-choice-actions';
import { multiplayerOpponentShown } from '@libs/synthetic-population-harness-ts/opponent-finding-actions';
import { givenSyntheticPairGame } from '@libs/synthetic-population-harness-ts/synthetic-pair-fixtures';
import { syntheticUserActor } from '@libs/synthetic-population-harness-ts/synthetic-sign-in-actions';

const SECOND_MS = 1000;

Given(
  'the Synthetic User {string} is looking for a multiplayer opponent for {string}',
  async (w, name: string, game: string) => {
    await w.s.apply(givenSyntheticGameChoice, name);
    await w.s.apply(startSyntheticActivity, game, name);
  }
);
Given(
  'the Synthetic Users {string} and {string} have an ongoing {string} game against each other',
  async (w, first: string, second: string, game: string) => {
    await w.s.apply(givenSyntheticPairGame, first, second, game);
  }
);
Then(
  "{string}'s multiplayer opponent is {string} within {int} seconds",
  async (w, name: string, opponent: string, seconds: number) => {
    const shown = await w.s.until(
      (s) => multiplayerOpponentShown(s, syntheticUserActor(name)),
      { pred: (found) => found !== null, maxMs: seconds * SECOND_MS }
    );
    expect(shown?.opponent).toBe(opponent);
  }
);
