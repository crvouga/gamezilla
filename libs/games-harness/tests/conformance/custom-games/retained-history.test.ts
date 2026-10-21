/**
 * A custom game's retained position and its accepted actions are one
 * record: for every game offering custom games, a position the actions do
 * not replay to is refused before anyone plays or reviews from it, and the
 * stored game is left as it was. The position comes from the game's known
 * opening, replayed by its own rules; an action its rules refuse comes from
 * its known refused openings.
 */

import { expect, test } from 'bun:test';
import { playedRulesOf } from '@libs/game-session-harness/played-rules';
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
    const afterOpening = playedRulesOf(game).replay([opening!], 1);
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

  test('a retained action the game refuses is never replayed into a position', () => {
    const rules = createTurnGames([game.shared.turnGame]);
    for (const refused of game.fixtures.refusedOpenings) {
      const retained = {
        ...newCustomGame(
          'retained-match',
          'alice',
          game.shared.turnGame.rules.initial()
        ),
        status: 'active' as const,
        turn: 'black' as const,
        moves: [{ uci: refused, san: '1' }],
      };
      const before = JSON.stringify(retained);
      expect(() => customGamePositionAt(retained, 1, rules)).toThrow();
      expect(() =>
        playCustomGameMove(
          retained,
          game.fixtures.firstSideVictory[0]!,
          1000,
          rules
        )
      ).toThrow();
      expect(JSON.stringify(retained)).toBe(before);
    }
  });
});
