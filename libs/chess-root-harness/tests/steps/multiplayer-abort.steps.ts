import { expect } from 'bun:test';
import { passMultiplayerTime } from '@libs/chess-matchmaking-harness/multiplayer-time';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';
import {
  bothBoards,
  gameCommand,
  givenAbortedGame,
  refusal,
  sameBoards,
} from './multiplayer-world';

const SECOND_MS = 1000;

function passing(w: HarnessWorld, seconds: number) {
  return w.s.apply(passMultiplayerTime, seconds * SECOND_MS);
}

When('{int} seconds pass in multiplayer chess', passing);
When('{int} second passes in multiplayer chess', passing);
Given('{int} seconds have passed in multiplayer chess', passing);

When('{actor} aborts the multiplayer game', async (w, actor: Actor) => {
  await gameCommand(w, actor, 'abortMultiplayer');
});
Given(
  "{actor}'s {word} multiplayer game with {actor} was aborted",
  (w, a: Actor, timeControl: string, b: Actor) =>
    givenAbortedGame(w, a, b, timeControl)
);
Then('both people see the multiplayer game was aborted', async (w) => {
  expect((await bothBoards(w, (g) => g.outcome === 'aborted')).outcome).toBe(
    'aborted'
  );
});
Then('both people still see the multiplayer game was aborted', async (w) => {
  expect((await bothBoards(w, (g) => g.outcome === 'aborted')).outcome).toBe(
    'aborted'
  );
});
Then('{actor} sees the multiplayer game was aborted', async (w, actor: Actor) => {
  const game = await sameBoards(w, actor, actor, (g) => g.outcome === 'aborted');
  expect(game.outcome).toBe('aborted');
});
Then(
  '{actor} is told the multiplayer game can no longer be aborted',
  (w, actor: Actor) => refusal(w, actor, 'CHESS_ABORT_TOO_LATE')
);
Then(
  '{actor} is told to abort the multiplayer game instead',
  (w, actor: Actor) => refusal(w, actor, 'CHESS_ABORT_INSTEAD')
);
Then('the multiplayer game is still unfinished', async (w) => {
  expect((await bothBoards(w)).outcome).toBe('ongoing');
});
