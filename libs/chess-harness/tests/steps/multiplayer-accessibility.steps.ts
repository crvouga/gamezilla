import { expect } from 'bun:test';
import { confirmMultiplayerCommand, findChessOpponent, moveMultiplayerPiece, openMultiplayerChess } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import { multiplayerText } from '@libs/chess-matchmaking-harness/multiplayer-reads';
import type { Actor } from '@libs/harness/parameter-types';
import { Given, Then, When } from '@libs/harness/define';
import { actorHtml } from '@libs/harness/observations';
import { multiplayerPeople } from './multiplayer-people';
import { givenGame, sameBoards } from './multiplayer-world';

Given(
  '{actor} has an account and is using the keyboard alone',
  async (w, actor: Actor) => {
    await multiplayerPeople(w, [actor]);
  }
);
Given(
  '{actor} is White in a new multiplayer game and is using the keyboard alone',
  async (w, actor: Actor) => {
    await givenGame(w, actor, 'bob');
  }
);
Given(
  '{actor} is White in a new multiplayer game and is listening to the app',
  async (w, actor: Actor) => {
    await givenGame(w, actor, 'bob');
  }
);
Given(
  '{actor} is listening to her unfinished multiplayer game with {actor}',
  async (w, actor: Actor, opponent: Actor) => {
    await givenGame(w, actor, opponent);
    await w.s.apply(openMultiplayerChess, actor);
  }
);
When(
  '{actor} finds a chess opponent with the keyboard',
  async (w, actor: Actor) => {
    await w.s.apply(findChessOpponent, actor, true);
    w.memo.set('multiplayer:acted', true);
  }
);
When(
  '{actor} plays {word} to {word} as a multiplayer move with the keyboard',
  async (w, actor: Actor, from: string, to: string) => {
    await w.s.apply(moveMultiplayerPiece, actor, from + to, true);
    await sameBoards(w, actor, 'bob', (g) => g.revision === 1);
  }
);
Then(
  '{actor} can resign multiplayer chess with the keyboard',
  async (w, actor: Actor) => {
    await w.s.apply(confirmMultiplayerCommand, actor, 'resign', true);
    expect(
      (await sameBoards(w, actor, 'bob', (g) => g.outcome !== 'ongoing')).reason
    ).toBe('resignation');
  }
);
Then(
  '{actor} hears she is White and has the multiplayer turn',
  async (w, actor: Actor) => {
    const spoken = await w.s.read(
      multiplayerText,
      actor,
      'multiplayer-announcement'
    );
    expect(spoken).toContain('You are White');
    expect(spoken).toContain('Your turn');
  }
);
Then(
  '{actor} hears what every multiplayer control does',
  async (w, actor: Actor) => {
    for (const [id, label] of [
      ['multiplayer-find', 'Find a chess opponent'],
      ['multiplayer-resign', 'Resign multiplayer chess'],
    ] as const)
      expect(await w.s.read(multiplayerText, actor, id)).toContain(label);
    const html = await w.s.read(actorHtml, actor);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-label=');
  }
);
Then('{actor} hears she won the multiplayer game', async (w, actor: Actor) => {
  await sameBoards(w, actor, 'bob', (g) => g.outcome !== 'ongoing');
  expect(
    await w.s.read(multiplayerText, actor, 'multiplayer-announcement')
  ).toContain('You won');
});
