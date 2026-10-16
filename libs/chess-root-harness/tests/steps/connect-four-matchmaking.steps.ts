import { expect } from 'bun:test';
import {
  connectFourSearchView,
  pairConnectFourOpponents,
  prepareConnectFourSearch,
  stopConnectFourSearch,
} from '@libs/connect-four-harness/connect-four-matchmaking';
import { Given, Then, When } from '@libs/harness/define';

Given(
  '{actor} and {actor} are seeking Connect Four at the same clock choice',
  async (w, a: string, b: string) => {
    await w.s.apply(prepareConnectFourSearch, a);
    await w.s.apply(prepareConnectFourSearch, b);
  }
);
Given(
  '{actor} seeks Connect Four and {actor} seeks chess',
  async (w, a: string, b: string) => {
    await w.s.apply(prepareConnectFourSearch, a);
    await w.s.apply(prepareConnectFourSearch, b, 'chess');
  }
);
Given(
  '{actor} is seeking a Connect Four opponent',
  async (w, actor: string) => {
    await w.s.apply(prepareConnectFourSearch, actor);
  }
);
When('they are paired for Connect Four', async (w) => {
  await w.s.apply(pairConnectFourOpponents);
});
When('opponents are paired', async (w) => {
  await w.s.apply(pairConnectFourOpponents);
});
When(
  '{actor} stops seeking a Connect Four opponent',
  async (w, actor: string) => {
    await w.s.apply(stopConnectFourSearch, actor);
  }
);
Then(
  '{actor} and {actor} receive the same Connect Four game with opposite sides',
  async (w, a: string, b: string) => {
    const first = await w.s.until((s) => connectFourSearchView(s, a), {
      pred: (view) => view.game !== null && view.board !== null,
    });
    const second = await w.s.until((s) => connectFourSearchView(s, b), {
      pred: (view) => view.game !== null && view.board !== null,
    });
    expect(first.game!.id).toBe(second.game!.id);
    expect(first.game).toEqual(second.game);
    expect(first.game!.white_id).not.toBe(first.game!.black_id);
    expect(first.game!.fen).toBe('c4:1:');
    expect(JSON.parse(first.board!)).toEqual(Array(42).fill(0));
  }
);
Then(
  '{actor} and {actor} are not paired together',
  async (w, a: string, b: string) => {
    expect((await w.s.read(connectFourSearchView, a)).game).toBeNull();
    expect((await w.s.read(connectFourSearchView, b)).game).toBeNull();
  }
);
Then(
  '{actor} is no longer waiting for Connect Four',
  async (w, actor: string) => {
    const view = await w.s.until((s) => connectFourSearchView(s, actor), {
      pred: (value) => !value.waiting,
    });
    expect(view.search?.standing).not.toBe('waiting');
    expect(view.game).toBeNull();
  }
);
