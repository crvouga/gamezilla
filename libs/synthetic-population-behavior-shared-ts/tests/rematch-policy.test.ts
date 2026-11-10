import { expect, test } from 'bun:test';
import {
  MAX_GAMES_IN_A_ROW,
  type OpponentStreak,
  streakAfterGame,
  wantsRematch,
} from '@libs/synthetic-population-behavior-shared-ts/rematch-policy';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

test('a Synthetic User never plays more than 3 games in a row against one opponent', () => {
  assertProperty(
    'at most three in a row',
    fc.property(
      fc.array(
        fc.tuple(
          fc.constantFrom('bob', 'carol'),
          fc.double({ min: 0, max: 1, noNaN: true })
        ),
        { maxLength: 30 }
      ),
      fc.double({ min: 0, max: 1, noNaN: true }),
      (games, weight) => {
        let streak: OpponentStreak | null = null;
        for (const [opponent, draw] of games) {
          // Only a wanted rematch extends a streak against the same opponent.
          if (
            streak !== null &&
            streak.opponent === opponent &&
            !wantsRematch(streak, weight, draw)
          )
            continue;
          streak = streakAfterGame(streak, opponent);
          expect(streak.games).toBeLessThanOrEqual(MAX_GAMES_IN_A_ROW);
        }
      }
    )
  );
});

test('a rematch is wanted by weight until the third game in a row', () => {
  const two = { opponent: 'bob', games: 2 };
  expect(wantsRematch(two, 1, 0.99)).toBe(true);
  expect(wantsRematch(two, 0, 0)).toBe(false);
  expect(wantsRematch({ opponent: 'bob', games: 3 }, 1, 0)).toBe(false);
  expect(streakAfterGame(two, 'carol')).toEqual({
    opponent: 'carol',
    games: 1,
  });
});
