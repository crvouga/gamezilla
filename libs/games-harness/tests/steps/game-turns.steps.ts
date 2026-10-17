import { expect } from 'bun:test';
import {
  customGameView,
  firstLegalMove,
  makeCustomGameMove,
} from '@libs/game-session-harness/custom-game-moves';
import { partition } from '@libs/harness/actions';
import { Given, Then, When } from '@libs/harness/define';
import { before, gameOf, setupCustomGame, sideOf, view } from './game-world';

const SECOND_MS = 1000;

Given(
  "{actor} and {actor} have a custom game after {actor}'s first move",
  async (w) => {
    const rules = gameOf(w).shared.turnGame.rules;
    await setupCustomGame(w, {
      moves: [firstLegalMove(gameOf(w), rules.initial())],
    });
  }
);
Given('{actor} and {actor} have a new custom game', async (w) =>
  setupCustomGame(w)
);
Given(
  '{actor} and {actor} have a new custom game without a connection',
  async (w, a: string, b: string) => {
    await setupCustomGame(w);
    await w.s.apply(partition, a);
    await w.s.apply(partition, b);
  }
);
Given('{actor} has a custom game one move from her victory', async (w) => {
  const victory = gameOf(w).firstSideVictory;
  await setupCustomGame(w, { moves: victory.slice(0, -1) });
  w.memo.set('winning-move', victory.at(-1));
});

When('{actor} makes his/her/a move', async (w, actor: string) => {
  await w.s.apply(makeCustomGameMove, actor, gameOf(w).shared.id);
});
When('{actor} makes the winning move', async (w, actor: string) => {
  await w.s.apply(
    makeCustomGameMove,
    actor,
    gameOf(w).shared.id,
    String(w.memo.get('winning-move'))
  );
});

Then(
  "{actor} is told it is the other player's turn",
  async (w, actor: string) => {
    expect((await view(w, actor)).error).toContain(
      'only the participant to move'
    );
  }
);
Then('the board and turn are unchanged', async (w) => {
  const now = await view(w);
  expect(now.current).toEqual(before(w).current);
  expect(now.displayFen).toBe(before(w).displayFen);
});
Then(
  "{actor} sees {actor}'s move within {int} seconds",
  async (w, watcher: string, _mover: string, seconds: number) => {
    await w.s.until((s) => customGameView(s, watcher), {
      maxMs: seconds * SECOND_MS,
      pred: (seen) => seen.current?.moves.length === 1,
    });
  }
);
Then(
  '{actor} is told the game needs a connection',
  async (w, actor: string) => {
    expect((await view(w, actor)).error).toBe('connection needed');
  }
);
Then('{actor} wins the custom game', async (w, actor: string) => {
  expect((await view(w)).current?.outcome).toStartWith(
    `${await sideOf(w, actor)} wins`
  );
});
Then('{actor} is told the game is finished', async (w, actor: string) => {
  expect((await view(w, actor)).error).toBe('finished');
});
