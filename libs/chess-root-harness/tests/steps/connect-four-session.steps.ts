import { expect } from 'bun:test';
import {
  chooseConnectFour,
  clickConnectFourColumn,
  connectFourView,
  dropConnectFour,
} from '@libs/connect-four-harness/connect-four-actions';
import { partition, restoreActorConnection } from '@libs/harness/actions';
import { Given, Then, When } from '@libs/harness/define';
import { four, setupFour } from './connect-four-world';

Given(
  '{actor} has a Connect Four custom game with {fourParticipants}',
  async (w, _actor: string, participants: string) => {
    await setupFour(w, {
      active: false,
      red:
        participants === 'two bots' || participants.startsWith('a bot')
          ? 'bot'
          : 'alice',
      yellow:
        participants === 'two ready people'
          ? 'bob'
          : participants.startsWith('a bot')
            ? 'alice'
            : 'bot',
    });
  }
);
Given(
  '{actor} has a Connect Four custom game with an open Yellow side',
  async (w) => setupFour(w, { yellow: 'open', active: false })
);
Given(
  '{actor} and {actor} have an active Connect Four custom game',
  async (w) => setupFour(w)
);
Given(
  '{actor} and {actor} have an active Connect Four custom game watched by {actor}',
  async (w, _a: string, _b: string, watcher: string) =>
    setupFour(w, { watchers: [watcher] })
);
Given('{actor} has a completed Connect Four custom game', async (w) =>
  setupFour(w, { moves: [0, 1, 0, 1, 0, 1, 0] })
);
Given(
  '{actor} and {actor} have an active Connect Four custom game and {actor} is away',
  async (w, _a: string, _b: string, actor: string) => {
    await setupFour(w, { host: 'bob', red: 'bob', yellow: 'alice' });
    await w.s.apply(partition, actor);
  }
);
Given(
  '{actor} has made the next Connect Four drop',
  async (w, actor: string) => {
    await w.s.apply(dropConnectFour, actor, 3);
  }
);
When(
  '{actor} starts the Connect Four custom game',
  async (w, actor: string) => {
    await w.s.apply(chooseConnectFour, actor, { operation: 'start' });
  }
);
When('{actor} resigns from Connect Four', async (w, actor: string) => {
  await w.s.apply(chooseConnectFour, actor, { operation: 'resign' });
});
When('{actor} requests a Connect Four rematch', async (w, actor: string) => {
  await w.s.apply(chooseConnectFour, actor, { operation: 'rematch' });
});
When('{actor} returns to Connect Four', async (w, actor: string) => {
  await w.s.apply(restoreActorConnection, actor);
});
Then('the Connect Four custom game is active', async (w) => {
  expect((await four(w)).current?.status).toBe('active');
});
Then(
  '{actor} is told both Connect Four sides need participants',
  async (w, actor: string) => {
    expect((await four(w, actor)).error).toBe('both sides need participants');
  }
);
Then('Yellow wins Connect Four by resignation', async (w) => {
  expect((await four(w)).current?.outcome).toBe('black wins by resignation');
});
Then(
  '{actor} is told she is not a Connect Four participant',
  async (w, actor: string) => {
    expect((await four(w, actor)).error).toBe('not a participant');
  }
);
Then(
  'the new Connect Four game has swapped participants and an empty board',
  async (w) => {
    const before = w.memo.get('connect-four-before') as Awaited<
      ReturnType<typeof four>
    >;
    const next = await four(w);
    expect(next.current?.white).toEqual(before.current?.black);
    expect(next.current?.black).toEqual(before.current?.white);
    expect(next.current?.id).not.toBe(before.current?.id);
    expect(next.game.moves).toEqual([]);
  }
);
Then('the earlier Connect Four history is unchanged', async (w) => {
  const before = w.memo.get('connect-four-before') as Awaited<
    ReturnType<typeof four>
  >;
  expect(
    (await four(w)).history.find((g) => g.id === before.current?.id)
  ).toEqual(before.current!);
});
Then(
  '{actor} and {actor} see the same Connect Four board and turn',
  async (w, a: string, b: string) => {
    const first = await four(w, a);
    const second = await four(w, b);
    expect(first.board).toEqual(second.board);
    expect(first.current?.turn).toBe(second.current?.turn);
    expect(first.current?.moves).toEqual(second.current?.moves);
  }
);

Given(
  '{actor} has an active Connect Four game against a Yellow bot while offline',
  async (w, actor: string) => {
    await setupFour(w, { yellow: 'bot' });
    await w.s.apply(partition, actor);
  }
);
Given(
  '{actor} and {actor} have a new Connect Four game without a connection',
  async (w, a: string, b: string) => {
    await setupFour(w);
    await w.s.apply(partition, a);
    await w.s.apply(partition, b);
  }
);
When(
  '{actor} drops into Connect Four column {int} on the board',
  async (w, actor: string, column: number) => {
    await w.s.apply(clickConnectFourColumn, actor, column - 1);
  }
);
Then(
  'the Yellow Connect Four bot replies within {int} seconds',
  async (w, seconds: number) => {
    await w.s.until(connectFourView, {
      maxMs: seconds * 1000,
      pred: (view) => view.game.moves.length === 2,
    });
  }
);
Then(
  '{actor} is told Connect Four needs a connection',
  async (w, actor: string) => {
    expect((await four(w, actor)).error).toBe('connection needed');
  }
);
