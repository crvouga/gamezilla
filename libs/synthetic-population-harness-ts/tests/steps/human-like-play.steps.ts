import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { givenFinishedSyntheticGame } from '@libs/synthetic-population-harness-ts/continuity-actions';
import {
  givenGamesInARow,
  offerRematchTo,
  rematchAnswerSeen,
  rematchOffered,
} from '@libs/synthetic-population-harness-ts/rematch-actions';
import { givenSyntheticUser } from '@libs/synthetic-population-harness-ts/synthetic-user-fixtures';
import {
  firstMoveSeen,
  givenPreviousThinkingTime,
  syntheticUserToMove,
} from '@libs/synthetic-population-harness-ts/thinking-time-actions';

const SECOND_MS = 1000;
/** Memo key of the person the Synthetic User plays against. */
const PERSON = 'synthetic-population:opponent-person';

Given(
  'the Synthetic User {string} has an ongoing {string} game against {actor}',
  async (w, name: string, game: string, person: Actor) => {
    await w.s.apply(givenSyntheticUser, name, true, game);
    w.memo.set(PERSON, person);
  }
);
Given("it is {string}'s move", async (w, name: string) => {
  expect(await w.s.read(syntheticUserToMove, name)).toBe(true);
});
Given(
  "{string}'s thinking time for its previous move was {int} seconds",
  async (w, name: string, seconds: number) => {
    await w.s.apply(givenPreviousThinkingTime, name, seconds);
  }
);
Given(
  'the Synthetic User {string} has a finished {string} game against {actor}',
  async (w, name: string, game: string, _person: Actor) => {
    await w.s.apply(givenFinishedSyntheticGame, name, game);
  }
);
Given(
  'the Synthetic User {string} has played {int} {string} games in a row against {actor}',
  async (
    w,
    ...[name, games, game, person]: [string, number, string, Actor]
  ) => {
    await w.s.apply(givenFinishedSyntheticGame, name, game);
    await w.s.apply(givenGamesInARow, name, games, person);
  }
);
When(
  '{actor} offers {string} a rematch',
  async (w, actor: Actor, _name: string) => {
    await w.s.apply(offerRematchTo, actor);
  }
);
Then(
  '{string} makes a legal move with a thinking time of {int} to {int} seconds',
  async (w, _name: string, least: number, most: number) => {
    const move = await w.s.read(firstMoveSeen, w.memo.get(PERSON) as string);
    expect(move?.legal).toBe(true);
    expect(move?.thinkingMs ?? 0).toBeGreaterThanOrEqual(least * SECOND_MS);
    expect(move?.thinkingMs ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
      most * SECOND_MS
    );
  }
);
Then(
  '{string} still has not moved {int} second later',
  async (w, _name: string, seconds: number) => {
    const move = await w.s.read(firstMoveSeen, w.memo.get(PERSON) as string);
    expect(move?.thinkingMs ?? 0).toBeGreaterThan(seconds * SECOND_MS);
  }
);
Then(
  "{string}'s thinking time for this move is not {int} seconds",
  async (w, _name: string, seconds: number) => {
    const move = await w.s.read(firstMoveSeen, w.memo.get(PERSON) as string);
    expect(move).not.toBeNull();
    expect(Math.floor((move?.thinkingMs ?? 0) / SECOND_MS)).not.toBe(seconds);
  }
);
Then(
  '{string} answers the rematch within {int} seconds',
  async (w, _name: string, seconds: number) => {
    const answer = await w.s.read(rematchAnswerSeen);
    expect(answer?.afterMs ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
      seconds * SECOND_MS
    );
  }
);
Then(
  '{actor} is told {string} declines the rematch within {int} seconds',
  async (w, _actor: Actor, _name: string, seconds: number) => {
    const answer = await w.s.read(rematchAnswerSeen);
    expect(answer?.accepted).toBe(false);
    expect(answer?.afterMs ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
      seconds * SECOND_MS
    );
  }
);
Then(
  '{actor} is not offered a rematch by {string}',
  async (w, actor: Actor, _name: string) => {
    expect(await w.s.read(rematchOffered, actor)).toBe(false);
  }
);
