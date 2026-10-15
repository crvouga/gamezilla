import { expect, test } from 'bun:test';
import { connectFourRules } from '@libs/connect-four-shared/connect-four-rules';
import { playCustomGameMove } from '@libs/game-session-shared/custom-game-play';
import { customGamePositionAt } from '@libs/game-session-shared/custom-game-position';
import { newCustomGame } from '@libs/game-session-shared/custom-game-state';
import { createTurnGames } from '@pkgs/turn-game-shared/game-rules';

// regression: game-session-inconsistent-retained-history
test('a retained first drop cannot be silently paired with an empty action history', () => {
  const rules = createTurnGames([
    { rules: connectFourRules, controlPrefix: 'connect-four/' },
  ]);
  const game = {
    ...newCustomGame('retained-match', 'alice', 'c4:1:3'),
    status: 'active' as const,
  };
  const before = JSON.stringify(game);
  expect(() => customGamePositionAt(game, 0, rules)).toThrow('action history');
  expect(() => playCustomGameMove(game, '2', 1000, rules)).toThrow(
    'action history'
  );
  expect(JSON.stringify(game)).toBe(before);
});
