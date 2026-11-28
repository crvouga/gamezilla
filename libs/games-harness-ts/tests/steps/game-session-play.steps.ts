import { expect } from 'bun:test';
import { firstLegalMove } from '@libs/game-session-harness-ts/game-session-moves';
import { gameSessionView } from '@libs/game-session-harness-ts/game-session-probe';
import { readGameSessionMoveList } from '@libs/game-session-harness-ts/game-session-reads';
import { recordedMove } from '@libs/game-session-harness-ts/played-rules';
import { Given, Then } from '@libs/harness-ts/define';
import { chosen, current, toldOf } from './game-session-set-up-world';
import {
  before,
  hostOf,
  positionAfter,
  rememberGameSession,
  turnGameOf,
} from './game-world';

const SECOND_MS = 1000;

Given(
  '{actor} has cancelled the game session under way',
  async (w, actor: string) => {
    await chosen(w, actor, { operation: 'cancel' });
    await rememberGameSession(w);
  }
);

Then("the move list shows {actor}'s move", async (w, _mover: string) => {
  const earlier = before(w).current;
  if (earlier === null) throw new Error('No game session set up');
  const game = await current(w);
  // The move made is the first the game's rules allow from where it stood.
  expect(game.moves.map((move) => move.uci)).toEqual([
    ...earlier.moves.map((move) => move.uci),
    recordedMove(
      turnGameOf(w),
      earlier.fen,
      firstLegalMove(turnGameOf(w), earlier.fen)
    ),
  ]);
  expect(await w.s.read(readGameSessionMoveList, hostOf(w))).toEqual(
    game.moves.map((move) => move.san)
  );
});
Then('the move list is unchanged', async (w) => {
  expect((await current(w)).moves).toEqual(before(w).current?.moves ?? []);
});
Then(
  'the bot replies with a legal move within {int} seconds',
  async (w, seconds: number) => {
    const seen = await w.s.until((s) => gameSessionView(s, hostOf(w)), {
      maxMs: seconds * SECOND_MS,
      pred: (view) => view.current?.moves.length === 2,
    });
    const moves = seen.current?.moves.map((move) => move.uci) ?? [];
    expect(moves).toHaveLength(2);
    // The reply as recorded is a move the rules accept from where it was made.
    const rules = turnGameOf(w).shared.turnGame.rules;
    const before = positionAfter(w, moves, 1);
    expect(rules.play(before, moves[1]!, '', moves.slice(0, 1))).not.toBeNull();
  }
);
Then(
  '{actor} is told the game session has not started',
  async (w, actor: string) => toldOf(w, actor, 'not started')
);
