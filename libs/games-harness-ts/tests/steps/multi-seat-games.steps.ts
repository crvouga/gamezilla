import { expect } from 'bun:test';
import { customGameView } from '@libs/game-session-harness-ts/custom-game-probe';
import { Given, Then } from '@libs/harness-ts/define';
import { gameSides } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  chosen,
  current,
  identityOf,
  toldOf,
} from './custom-game-set-up-world';
import { gameOf, setupCustomGame } from './game-world';

const PEOPLE = ['alice', 'bob', 'carol', 'dave'] as const;

Given(
  'Alice, Bob, Carol and Dave are setting up a four-player custom game',
  async (w) =>
    setupCustomGame(w, {
      third: 'carol',
      fourth: 'dave',
      ready: false,
      active: false,
    })
);
Given('all four people are ready for the custom game', async (w) => {
  for (const person of PEOPLE) await chosen(w, person, { operation: 'ready' });
});
Given(
  'Alice, Bob and Carol are ready in a four-player custom game with an open fourth side',
  async (w) =>
    setupCustomGame(w, { third: 'carol', fourth: 'open', active: false })
);
Given('Alice, Bob and Carol are ready but Dave is not ready', async (w) => {
  for (const person of PEOPLE.slice(0, -1))
    await chosen(w, person, { operation: 'ready' });
});
Given(
  'Alice, Bob, Carol and Dave have a four-player custom game under way',
  async (w) => setupCustomGame(w, { third: 'carol', fourth: 'dave' })
);
Given(
  'Alice, Bob, Carol and Dave have a four-player custom game with Bob to move',
  async (w) =>
    setupCustomGame(w, {
      third: 'carol',
      fourth: 'dave',
      moves: gameOf(w).fixtures.firstSideVictory.slice(0, 1),
    })
);
Given('Alice has offered a draw accepted by Bob and Carol', async (w) => {
  await chosen(w, 'alice', { operation: 'offer' });
  await chosen(w, 'bob', { operation: 'agree' });
  await chosen(w, 'carol', { operation: 'agree' });
});
Given('Alice has offered a draw accepted by Bob', async (w) => {
  await chosen(w, 'alice', { operation: 'offer' });
  await chosen(w, 'bob', { operation: 'agree' });
});
Given(
  'Alice, Bob, Carol and Dave have a four-player custom game played at 1+0 with Carol to move',
  async (w) =>
    setupCustomGame(w, {
      third: 'carol',
      fourth: 'dave',
      clock: { minutes: 1, increment: 0 },
      moves: gameOf(w).fixtures.firstSideVictory.slice(0, 2),
    })
);

Then("the four sides follow the game's declared turn order", async (w) => {
  expect((await current(w)).sides).toEqual([
    ...gameSides(gameOf(w).shared.turnGame.rules),
  ]);
  for (const [index, person] of PEOPLE.entries()) {
    const seen = await w.s.read(customGameView, person);
    expect(seen.mySide).toBe((await current(w)).sides[index]!);
  }
});
Then(
  '{actor} is told every side needs a participant',
  async (w, actor: string) => toldOf(w, actor, 'every side needs a participant')
);
Then('Bob keeps the custom game turn', async (w) => {
  const game = await current(w);
  expect(game.status).toBe('active');
  expect(game[game.turn].person).toBe(await identityOf(w, 'bob'));
});
Then('Carol cannot make a custom game move before Bob', async (w) => {
  const seen = await w.s.read(customGameView, 'carol');
  expect(seen.gates['move']).toBe(false);
});
Then(
  "the custom game is still under way awaiting Dave's agreement",
  async (w) => {
    const game = await current(w);
    expect(game.status).toBe('active');
    expect(game.drawAcceptedBy).toHaveLength(3);
    expect(game.drawAcceptedBy).not.toContain(await identityOf(w, 'dave'));
  }
);
Then(
  'the custom game is finished as a draw because a participant withdrew',
  async (w) => {
    expect(await current(w)).toMatchObject({
      status: 'completed',
      outcome: 'draw',
      outcomeReason: 'participant withdrew',
    });
  }
);
Then(
  'the custom game is finished as a draw because a participant ran out of time',
  async (w) => {
    expect(await current(w)).toMatchObject({
      status: 'completed',
      outcome: 'draw',
      outcomeReason: 'timeout',
    });
  }
);
