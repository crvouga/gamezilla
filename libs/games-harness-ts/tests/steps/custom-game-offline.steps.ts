import { expect } from 'bun:test';
import {
  firstLegalMove,
  makeCustomGameMove,
} from '@libs/game-session-harness-ts/custom-game-moves';
import { customGameView } from '@libs/game-session-harness-ts/custom-game-probe';
import { customGameShownUnrated } from '@libs/game-session-harness-ts/custom-game-reads';
import type {
  CustomGame,
  CustomGameSide,
} from '@libs/game-session-shared-ts/custom-game-state';
import { Given, Then } from '@libs/harness-ts/define';
import { cutConnection } from '@libs/harness-ts/platform';
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
// Her device answers her move with the bot's reply, unless only the room
// decides it (a game with private setups): then the move waits, unanswered.
Given('{actor} has made her move while offline', async (w, actor: string) => {
  await cutConnection(w, actor);
  await w.s.apply(makeCustomGameMove, actor, gameOf(w).shared.id);
  const seen = await w.s.until((s) => customGameView(s, actor), {
    pred: (view) => view.current?.moves.length === 2 || view.waiting,
    maxMs: 5 * SECOND_MS,
  });
  w.memo.set(OFFLINE_MOVES, seen.waiting ? [] : seen.current?.moves);
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
  const kept = w.memo.get(OFFLINE_MOVES) as CustomGame['moves'];
  const rules = gameOf(w).shared.turnGame.rules;
  if (kept.length === 0) {
    // Her waiting move was played once sent, and the bot replied.
    const seen = await w.s.until((s) => customGameView(s, hostOf(w)), {
      pred: (view) => view.current?.moves.length === 2,
      maxMs: 5 * SECOND_MS,
    });
    expect(
      rules.play(rules.initial(), seen.current?.moves[0]?.uci ?? '', '', [])
    ).not.toBeNull();
    return;
  }
  const game = await current(w);
  expect(game.moves).toHaveLength(2);
  // Her move is the first the game's rules allow from its start.
  expect(game.moves[0]?.uci).toBe(firstLegalMove(gameOf(w), rules.initial()));
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
    expect(
      rules.play(
        positionAfter(w, moves, ply),
        moves[ply]!,
        '',
        moves.slice(0, ply)
      )
    ).not.toBeNull();
  }
);
