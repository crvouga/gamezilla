import { expect } from 'bun:test';
import { makeCustomGameMove } from '@libs/game-session-harness-ts/custom-game-moves';
import { Given, Then } from '@libs/harness-ts/define';
import { chosen, current, toldOf } from './custom-game-set-up-world';
import { gameOf, setupCustomGame } from './game-world';

Given(
  '{actor} has a custom game under way against a bot',
  async (w, actor: string) =>
    setupCustomGame(w, { first: actor, second: 'bot' })
);
Given(
  '{actor} has offered {actor} a draw in their custom game',
  async (w, offerer: string) => chosen(w, offerer, { operation: 'offer' })
);
Given(
  "{actor} has declined {actor}'s draw offer",
  async (w, actor: string, offerer: string) => {
    await chosen(w, offerer, { operation: 'offer' });
    await chosen(w, actor, { operation: 'reject' });
  }
);
Given('{actor} has since made her/his move', async (w, actor: string) =>
  w.s.apply(makeCustomGameMove, actor, gameOf(w).shared.id)
);

Then('{actor} is told a draw needs two people', async (w, actor: string) =>
  toldOf(w, actor, 'draw agreement needs two people')
);
Then(
  '{actor} is told only the other participant may accept the draw',
  async (w, actor: string) => toldOf(w, actor, 'not the other participant')
);
Then(
  '{actor} is told she may offer a draw again after her next move',
  async (w, actor: string) => toldOf(w, actor, 'offer again after moving')
);
Then('the custom game is finished as a draw', async (w) => {
  const game = await current(w);
  expect(game.status).toBe('completed');
  expect(game.outcome).toBe('draw');
});
