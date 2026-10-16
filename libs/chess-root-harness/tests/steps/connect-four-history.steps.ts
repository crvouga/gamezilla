import { expect } from 'bun:test';
import {
  connectFourHistoryStatistics,
  openConnectFourHistory,
  reviewConnectFour,
} from '@libs/connect-four-harness/connect-four-review';
import { Given, Then, When } from '@libs/harness/define';
import { four, setupFour } from './connect-four-world';

Given('{actor} has won a Connect Four game', async (w) =>
  setupFour(w, { moves: [0, 1, 0, 1, 0, 1, 0] })
);
When(
  '{actor} reviews the third Connect Four drop',
  async (w, actor: string) => {
    await w.s.apply(reviewConnectFour, actor, 3);
  }
);
When(
  '{actor} reviews an unplayed Connect Four drop',
  async (w, actor: string) => {
    await w.s.apply(reviewConnectFour, actor, 43);
  }
);
When('{actor} opens her Connect Four history', async (w, actor: string) => {
  await w.s.apply(openConnectFourHistory, actor);
});
Then(
  '{actor} sees the Connect Four board after three drops',
  async (w, actor: string) => {
    expect((await four(w, actor)).game.moves).toHaveLength(3);
  }
);
Then('the completed Connect Four history is unchanged', async (w) => {
  const before = w.memo.get('connect-four-before') as Awaited<
    ReturnType<typeof four>
  >;
  expect((await four(w)).current).toEqual(before.current);
});
Then(
  '{actor} is told that Connect Four drop was not played',
  async (w, actor: string) => {
    expect((await four(w, actor)).error).toBe('no such move');
  }
);
Then(
  '{actor} sees her Connect Four victory and its participants',
  async (w, actor: string) => {
    const stats = await w.s.read(connectFourHistoryStatistics, actor);
    expect(stats.wins).toBe(1);
    expect(stats.losses).toBe(0);
    expect(stats.draws).toBe(0);
    expect(stats.record).not.toBe('');
  }
);
