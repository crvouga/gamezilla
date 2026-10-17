import { expect } from 'bun:test';
import {
  customGameView,
  firstLegalMove,
  makeCustomGameMove,
} from '@libs/game-session-harness/custom-game-moves';
import { customGameShownUnrated } from '@libs/game-session-harness/custom-game-reads';
import type {
  CustomGame,
  CustomGameSide,
} from '@libs/game-session-shared/custom-game-state';
import { Given, Then } from '@libs/harness/define';
import { cutConnection } from '@libs/harness/platform';
import {
  choose,
  clockChoice,
  current,
  inSpace,
} from './custom-game-set-up-world';
import { gameOf, hostOf, positionAfter, setupCustomGame } from './game-world';

const SECOND_MS = 1000;
const OFFLINE_MOVES = 'custom-game-offline-moves';

Given(
  '{actor} has a custom game under way against a bot played at {word}',
  async (w, actor: string, clock: string) =>
    setupCustomGame(w, {
      first: actor,
      second: 'bot',
      clock: clockChoice(clock),
    })
);
Given('{actor} has made her move while offline', async (w, actor: string) => {
  await cutConnection(w, actor);
  await w.s.apply(makeCustomGameMove, actor, gameOf(w).shared.id);
  const seen = await w.s.until((s) => customGameView(s, actor), {
    pred: (view) => view.current?.moves.length === 2,
    maxMs: 5 * SECOND_MS,
  });
  w.memo.set(OFFLINE_MOVES, seen.current?.moves);
});
Given(
  '{actor} has resigned a custom game against a bot while offline',
  async (w, actor: string) => {
    await setupCustomGame(w, { first: actor, second: 'bot' });
    await cutConnection(w, actor);
    await choose(w, actor, { operation: 'resign' });
    expect((await current(w)).status).toBe('completed');
  }
);
Given(
  '{actor} is watching the custom game while offline',
  async (w, actor: string) => {
    await inSpace(w, actor);
    await cutConnection(w, actor);
  }
);

Then('the custom game is finished by resignation', async (w) => {
  const game = await current(w);
  expect(game.status).toBe('completed');
  expect(game.outcome).toMatch(/^(white|black) wins by resignation$/);
});
Then('the custom game is unrated', async (w) => {
  await current(w);
  expect(await w.s.read(customGameShownUnrated, hostOf(w))).toBe(true);
});
Then("the custom game keeps her move and the bot's reply", async (w) => {
  const game = await current(w);
  const kept = w.memo.get(OFFLINE_MOVES) as CustomGame['moves'];
  expect(game.moves).toHaveLength(2);
  // Her move is the first the game's rules allow from its start.
  expect(game.moves[0]?.uci).toBe(
    firstLegalMove(gameOf(w), gameOf(w).shared.turnGame.rules.initial())
  );
  expect(game.moves).toEqual(kept);
});
Then(
  "a legal move by the {gameSide}'s bot follows within {int} seconds",
  async (w, side: CustomGameSide, seconds: number) => {
    const ply = side === 'white' ? 0 : 1;
    const seen = await w.s.until((s) => customGameView(s, hostOf(w)), {
      pred: (view) => (view.current?.moves.length ?? 0) > ply,
      maxMs: seconds * SECOND_MS,
    });
    const moves = seen.current?.moves.map((move) => move.uci) ?? [];
    const rules = gameOf(w).shared.turnGame.rules;
    expect(rules.legal(positionAfter(w, moves, ply))).toContain(moves[ply]!);
  }
);
