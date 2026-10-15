import { expect } from 'bun:test';
import { dropConnectFour } from '@libs/connect-four-harness/connect-four-actions';
import { CONNECT_FOUR_FIXTURES } from '@libs/connect-four-harness/connect-four-fixtures';
import { Given, Then, When } from '@libs/harness/define';
import { four, setupFour } from './connect-four-world';

Given('{actor} has a new Connect Four game', async (w) => setupFour(w));
Given('{actor} and {actor} have a new Connect Four game', async (w) =>
  setupFour(w)
);
Given(
  "{actor} and {actor} have a Connect Four game after Red's first drop",
  async (w) => setupFour(w, { moves: [3] })
);
Given('{actor} has a Connect Four game with column 4 full', async (w) =>
  setupFour(w, { moves: [3, 3, 3, 3, 3, 3] })
);
Given('{actor} has a completed Connect Four game', async (w) =>
  setupFour(w, { moves: [0, 1, 0, 1, 0, 1, 0] })
);
Given(
  '{actor} has a Connect Four game one drop before a {fourDirection} winning alignment',
  async (w, _actor: string, direction: string) => {
    const moves =
      CONNECT_FOUR_FIXTURES[direction as keyof typeof CONNECT_FOUR_FIXTURES];
    if (moves === undefined) throw new Error('Unknown winning direction');
    await setupFour(w, { moves: moves.slice(0, -1) });
    w.memo.set('connect-four-next', moves.at(-1));
  }
);
Given(
  '{actor} has a Connect Four game one drop before a full-board draw',
  async (w) => {
    const moves = CONNECT_FOUR_FIXTURES.draw;
    await setupFour(w, {
      red: 'bob',
      yellow: 'alice',
      moves: moves.slice(0, -1),
    });
    w.memo.set('connect-four-next', moves.at(-1));
  }
);
When(
  '{actor} drops into Connect Four column {int}',
  async (w, actor: string, column: number) => {
    await w.s.apply(dropConnectFour, actor, column - 1);
  }
);
When(
  '{actor} makes the winning Connect Four drop',
  async (w, actor: string) => {
    await w.s.apply(
      dropConnectFour,
      actor,
      Number(w.memo.get('connect-four-next'))
    );
  }
);
When('{actor} fills the last Connect Four column', async (w, actor: string) => {
  await w.s.apply(
    dropConnectFour,
    actor,
    Number(w.memo.get('connect-four-next'))
  );
});
Then(
  'Red occupies the bottom of Connect Four column {int}',
  async (w, column: number) => {
    expect((await four(w)).board[column - 1]).toBe(1);
  }
);
Then('Yellow has the Connect Four turn', async (w) => {
  expect((await four(w)).current?.turn).toBe('black');
});
Then('Red has the Connect Four turn', async (w) => {
  expect((await four(w)).current?.turn).toBe('white');
});
Then(
  '{actor} is told that Connect Four column is full',
  async (w, actor: string) => {
    expect((await four(w, actor)).error).toBe('move is illegal');
  }
);
Then(
  "{actor} is told it is the other player's Connect Four turn",
  async (w, actor: string) => {
    expect((await four(w, actor)).error).toContain(
      'only the participant to move'
    );
  }
);
Then(
  '{actor} is told the Connect Four game is finished',
  async (w, actor: string) => {
    expect((await four(w, actor)).error).toBe('finished');
  }
);
Then('the Connect Four board and turn are unchanged', async (w) => {
  const before = w.memo.get('connect-four-before') as Awaited<
    ReturnType<typeof four>
  >;
  const now = await four(w);
  expect(now.current).toEqual(before.current);
  expect(now.board).toEqual(before.board);
});
Then('Red wins Connect Four', async (w) => {
  expect((await four(w)).current?.outcome).toBe('white wins by four in a row');
});
Then('the Connect Four winning alignment is identified', async (w) => {
  const view = await four(w);
  expect(view.game.winning.length).toBeGreaterThanOrEqual(4);
  expect(view.winningShown).toBe(view.game.winning.length);
});
Then('Connect Four ends in a draw', async (w) => {
  expect((await four(w)).current?.outcome).toBe('draw');
});
