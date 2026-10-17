import { expect } from 'bun:test';
import { pairGameOpponents } from '@libs/game-matchmaking-harness/multiplayer-fixtures';
import {
  opponentSearchView,
  seekGameOpponent,
  stopSeekingOpponent,
} from '@libs/game-matchmaking-harness/opponent-seeking';
import { Given, Then, When } from '@libs/harness/define';
import { anotherGame, gameOf } from './game-world';

Given(
  '{actor} and {actor} are seeking an opponent for the game at the same clock choice',
  async (w, a: string, b: string) => {
    await w.s.apply(seekGameOpponent, a, gameOf(w).shared.id);
    await w.s.apply(seekGameOpponent, b, gameOf(w).shared.id);
  }
);
Given(
  '{actor} seeks an opponent for the game and {actor} seeks an opponent for another game',
  async (w, a: string, b: string) => {
    await w.s.apply(seekGameOpponent, a, gameOf(w).shared.id);
    await w.s.apply(
      seekGameOpponent,
      b,
      anotherGame(w, 'matchmaking').shared.id
    );
  }
);
Given(
  '{actor} is seeking an opponent for the game',
  async (w, actor: string) => {
    await w.s.apply(seekGameOpponent, actor, gameOf(w).shared.id);
  }
);
When('they are paired', async (w) => {
  await w.s.apply(pairGameOpponents, 'alice', true);
});
When('{actor} stops seeking an opponent', async (w, actor: string) => {
  await w.s.apply(stopSeekingOpponent, actor);
});
Then(
  '{actor} and {actor} receive the same new game on opposite sides',
  async (w, a: string, b: string) => {
    const seen = [];
    for (const actor of [a, b])
      seen.push(
        await w.s.until((s) => opponentSearchView(s, actor), {
          pred: (view) => view.game !== null && view.board,
        })
      );
    const [first, second] = seen;
    expect(first!.game).toEqual(second!.game);
    expect(first!.game!.white_id).not.toBe(first!.game!.black_id);
    expect(first!.game!.fen).toBe(gameOf(w).shared.turnGame.rules.initial());
  }
);
Then(
  '{actor} and {actor} are not paired together',
  async (w, a: string, b: string) => {
    expect((await w.s.read(opponentSearchView, a)).game).toBeNull();
    expect((await w.s.read(opponentSearchView, b)).game).toBeNull();
  }
);
Then(
  '{actor} is no longer waiting for an opponent',
  async (w, actor: string) => {
    const view = await w.s.until((s) => opponentSearchView(s, actor), {
      pred: (value) => !value.waiting,
    });
    expect(view.search?.standing).not.toBe('waiting');
    expect(view.game).toBeNull();
  }
);
