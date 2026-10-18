import { expect, test } from 'bun:test';
import { connectFourGameShared } from '@libs/connect-four-shared/connect-four-game';
import { connectFourRules } from '@libs/connect-four-shared/connect-four-rules';
import { playCustomGameMove } from '@libs/game-session-shared/custom-game-play';
import { customGamePositionAt } from '@libs/game-session-shared/custom-game-position';
import { newCustomGame } from '@libs/game-session-shared/custom-game-state';
import { createTurnGames } from '@pkgs/turn-game-shared/game-rules';

test('an empty accepted action cannot be normalized into a legal retained drop', () => {
  // regression: connect-four-replay-normalizes-invalid-actions
  const rules = createTurnGames([connectFourGameShared.turnGame]);
  const game = {
    ...newCustomGame('retained-match', 'alice', 'c4:1:0'),
    status: 'active' as const,
    turn: 'black' as const,
    moves: [{ uci: '', san: '1' }],
  };
  const before = JSON.stringify(game);
  expect(() => customGamePositionAt(game, 1, rules)).toThrow();
  expect(() => playCustomGameMove(game, '1', 1000, rules)).toThrow();
  expect(JSON.stringify(game)).toBe(before);
});

test.each([' ', '1.0', '1e0', '+1', '01', '0\n', '1\r\n'])(
  'replay rejects the same noncanonical column syntax as live play: %s',
  (action) => {
    expect(connectFourRules.play('c4:1:', action, '', [])).toBeNull();
    expect(() => connectFourRules.replay([action], 1)).toThrow();
  }
);
