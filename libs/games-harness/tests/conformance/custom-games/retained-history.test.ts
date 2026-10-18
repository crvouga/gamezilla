/**
 * A custom game's retained position and its accepted actions are one
 * record: for every game offering custom games, a position the actions do
 * not replay to is refused before anyone plays or reviews from it, and the
 * stored game is left as it was. The position comes from the game's known
 * opening, replayed by its own rules.
 */

import { expect, test } from 'bun:test';
import { playCustomGameMove } from '@libs/game-session-shared/custom-game-play';
import { customGamePositionAt } from '@libs/game-session-shared/custom-game-position';
import { newCustomGame } from '@libs/game-session-shared/custom-game-state';
import { createTurnGames } from '@pkgs/turn-game-shared/game-rules';
import { forEveryGame } from '../game-suite';

forEveryGame(import.meta.path, (game) => {
  // regression: game-session-inconsistent-retained-history
  test('a retained first move cannot be silently paired with an empty action history', () => {
    const rules = createTurnGames([game.shared.turnGame]);
    const [opening, reply] = game.fixtures.firstSideVictory;
    const afterOpening = game.shared.turnGame.rules.replay([opening!], 1);
    const retained = {
      ...newCustomGame('retained-match', 'alice', afterOpening),
      status: 'active' as const,
    };
    const before = JSON.stringify(retained);
    expect(() => customGamePositionAt(retained, 0, rules)).toThrow(
      'action history'
    );
    expect(() => playCustomGameMove(retained, reply!, 1000, rules)).toThrow(
      'action history'
    );
    expect(JSON.stringify(retained)).toBe(before);
  });
});
