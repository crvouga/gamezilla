import { expect } from 'bun:test';
import {
  firstLegalMove,
  makeGameSessionMove,
} from '@libs/game-session-harness-ts/game-session-moves';
import { gameSessionView } from '@libs/game-session-harness-ts/game-session-probe';
import { gameSessionShownUnrated } from '@libs/game-session-harness-ts/game-session-reads';
import type {
  GameSession,
  GameSessionSide,
} from '@libs/game-session-shared-ts/game-session-state';
import { Given, Then } from '@libs/harness-ts/define';
import { cutConnection } from '@libs/harness-ts/platform';
import {
  choose,
  clockChoice,
  current,
  inSpace,
} from './game-session-set-up-world';
import {
  gameOf,
  hostOf,
  positionAfter,
  setupGameSession,
  turnGameOf,
} from './game-world';

const SECOND_MS = 1000;
const OFFLINE_MOVES = 'game-session-offline-moves';

Given(
  '{actor} has a game session under way against a bot played at {word}',
  async (w, actor: string, clock: string) =>
    setupGameSession(w, {
      first: actor,
      second: 'bot',
      clock: clockChoice(clock),
    })
);
// Her device answers her move with the bot's reply, unless only the room
// decides it (a game with private setups): then the move waits, unanswered.
Given('{actor} has made her move while offline', async (w, actor: string) => {
  await cutConnection(w, actor);
  await w.s.apply(makeGameSessionMove, actor, gameOf(w).shared.id);
  const seen = await w.s.until((s) => gameSessionView(s, actor), {
    pred: (view) => view.current?.moves.length === 2 || view.waiting,
    maxMs: 5 * SECOND_MS,
  });
  w.memo.set(OFFLINE_MOVES, seen.waiting ? [] : seen.current?.moves);
});
Given(
  '{actor} has resigned a game session against a bot while offline',
  async (w, actor: string) => {
    await setupGameSession(w, { first: actor, second: 'bot' });
    await cutConnection(w, actor);
    await choose(w, actor, { operation: 'resign' });
    expect((await current(w)).status).toBe('completed');
  }
);
Given(
  '{actor} is watching the game session while offline',
  async (w, actor: string) => {
    await inSpace(w, actor);
    await cutConnection(w, actor);
  }
);

Then('the game session is finished by resignation', async (w) => {
  const game = await current(w);
  expect(game.status).toBe('completed');
  expect(game.outcome).toMatch(/^(white|black) wins by resignation$/);
});
Then('the game session is unrated', async (w) => {
  await current(w);
  expect(await w.s.read(gameSessionShownUnrated, hostOf(w))).toBe(true);
});
Then("the game session keeps her move and the bot's reply", async (w) => {
  const kept = w.memo.get(OFFLINE_MOVES) as GameSession['moves'];
  const rules = turnGameOf(w).shared.turnGame.rules;
  if (kept.length === 0) {
    // Her waiting move was played once sent, and the bot replied.
    const seen = await w.s.until((s) => gameSessionView(s, hostOf(w)), {
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
  expect(game.moves[0]?.uci).toBe(
    firstLegalMove(turnGameOf(w), rules.initial())
  );
  expect(game.moves).toEqual(kept);
});
Then(
  "a legal move by the {gameSide}'s bot follows within {int} seconds",
  async (w, side: GameSessionSide, seconds: number) => {
    const ply = side === 'white' ? 0 : 1;
    const seen = await w.s.until((s) => gameSessionView(s, hostOf(w)), {
      pred: (view) => (view.current?.moves.length ?? 0) > ply,
      maxMs: seconds * SECOND_MS,
    });
    const moves = seen.current?.moves.map((move) => move.uci) ?? [];
    const rules = turnGameOf(w).shared.turnGame.rules;
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
