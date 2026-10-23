import { expect } from 'bun:test';
import {
  connectFourColumn,
  connectFourStatus,
  dropConnectFour,
  preferConnectFourReducedMotion,
  previewConnectFour,
} from '@libs/connect-four-harness-ts/connect-four-actions';
import { Given, Then, When } from '@libs/harness-ts/define';
import { four, setupFour } from './connect-four-world';

Given(
  '{actor} has a new Connect Four game with reduced motion',
  async (w, actor: string) => {
    await setupFour(w);
    await w.s.apply(preferConnectFourReducedMotion, actor);
  }
);
When(
  '{actor} chooses Connect Four column {int} with the keyboard',
  async (w, actor: string, column: number) => {
    await w.s.apply(previewConnectFour, actor, column - 1);
  }
);
When('{actor} follows the Connect Four board', async (w) => {
  await four(w);
});
When(
  '{actor} drops into Connect Four column {int} using the keyboard',
  async (w, actor: string, column: number) => {
    await w.s.apply(dropConnectFour, actor, column - 1, true);
  }
);
Then(
  'the Connect Four preview marks the bottom of column {int}',
  async (w, column: number) => {
    expect((await four(w)).preview).toBe(column - 1);
  }
);
Then('the Connect Four board has no played discs', async (w) => {
  expect((await four(w)).game.moves).toHaveLength(0);
});
Then(
  'Connect Four column {int} is identified as full and unavailable',
  async (w, column: number) => {
    const view = await w.s.read(connectFourColumn, 'alice', column - 1);
    expect(view.full).toBe('true');
    expect(view.disabled).toBe('true');
    expect(view.label).toContain('full');
  }
);
Then(
  "the Connect Four board identifies Red's disc and Yellow's turn",
  async (w) => {
    expect((await four(w)).board[3]).toBe(1);
    expect(await w.s.read(connectFourStatus, 'alice')).toContain('Yellow');
  }
);
