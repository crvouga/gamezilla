import { expect } from 'bun:test';
import { establishCustomGame } from '@libs/game-session-harness-ts/custom-game-lineup';
import {
  gameHistoryStatistics,
  openGameHistory,
  reviewCustomGameMove,
} from '@libs/game-session-harness-ts/game-history-actions';
import { switchSpaceGame } from '@libs/game-session-harness-ts/game-navigation';
import { Given, Then, When } from '@libs/harness-ts/define';
import {
  anotherGame,
  before,
  gameOf,
  positionAfter,
  setupCustomGame,
  view,
} from './game-world';

Given('{actor} has won a custom game', async (w) =>
  setupCustomGame(w, { moves: gameOf(w).fixtures.firstSideVictory })
);
Given(
  '{actor} has won a custom game of another game',
  async (w, actor: string) => {
    const other = anotherGame(w, 'history');
    await w.s.apply(establishCustomGame, other.shared.id, {
      host: actor,
      first: actor,
      moves: other.fixtures.firstSideVictory,
    });
    await w.s.apply(switchSpaceGame, actor, gameOf(w).shared.id);
  }
);
When('{actor} reviews the third move', async (w, actor: string) => {
  await w.s.apply(reviewCustomGameMove, actor, 3);
});
When('{actor} reviews the starting position', async (w, actor: string) => {
  await w.s.apply(reviewCustomGameMove, actor, 0);
});
When('{actor} reviews a move that was not played', async (w, actor: string) => {
  const played = (await view(w, actor)).current?.moves.length ?? 0;
  await w.s.apply(reviewCustomGameMove, actor, played + 1);
});
When("{actor} opens the game's history", async (w, actor: string) => {
  await w.s.apply(openGameHistory, actor);
});
Then('{actor} sees the board after three moves', async (w, actor: string) => {
  const seen = await view(w, actor);
  const moves = seen.current?.moves.map((move) => move.uci) ?? [];
  expect(seen.displayFen).toBe(positionAfter(w, moves, 3));
});
Then("{actor} sees the game's starting position", async (w, actor: string) => {
  const seen = await view(w, actor);
  expect(seen.reviewPly).toBe(0);
  expect(seen.displayFen).toBe(gameOf(w).shared.turnGame.rules.initial());
});
Then('the finished custom game is unchanged', async (w) => {
  expect((await view(w)).current).toEqual(before(w).current);
});
Then('{actor} is told that move was not played', async (w, actor: string) => {
  expect((await view(w, actor)).error).toBe('no such move');
});
Then(
  '{actor} sees her victory and its participants',
  async (w, actor: string) => {
    const stats = await w.s.read(gameHistoryStatistics, actor);
    expect([stats.wins, stats.losses, stats.draws]).toEqual([1, 0, 0]);
    expect(stats.record).not.toBe('');
  }
);
Then('{actor} sees no victories', async (w, actor: string) => {
  expect((await w.s.read(gameHistoryStatistics, actor)).wins).toBe(0);
});
