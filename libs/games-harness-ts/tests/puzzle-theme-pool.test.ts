/**
 * The pool "puzzles with and without a theme of the game's known puzzle"
 * (`specs/games/puzzle-feed.feature`) leaves a puzzle with the theme to move
 * on to whichever two the feed has already put on the board: the one served
 * before the feed was limited and the one limiting brought.
 */
import { expect, test } from 'bun:test';
import { isTurnHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { CONFORMANCE_GAMES } from './conformance-world';
import { themePool } from './steps/theme-pool';

const PUZZLE_GAMES = CONFORMANCE_GAMES.filter(isTurnHarnessGame).filter(
  (game) => game.shared.registration.capabilities.puzzles !== undefined
);

// regression: puzzle-theme-pool-exhausted-by-first-pick
test('after the counting race serves leap-past-four, then leap-home once limited, a puzzle with the theme is left', () => {
  const game = PUZZLE_GAMES.find(
    (candidate) => candidate.shared.id === 'counting-race'
  );
  if (game === undefined) throw new Error('the counting race offers puzzles');
  const { themed } = themePool(game);
  const seen = ['counting-race/leap-past-four', 'counting-race/leap-home'];
  expect(themed).toEqual(expect.arrayContaining(seen));
  expect(themed.filter((id) => !seen.includes(id)).length).toBeGreaterThan(0);
});

for (const game of PUZZLE_GAMES)
  test(`${game.label}: whichever two puzzles with the theme were served, another is left, and the rest lack the theme`, () => {
    const { theme, pool, themed } = themePool(game);
    expect(new Set(pool.map((puzzle) => puzzle.id)).size).toBe(pool.length);
    for (const puzzle of pool)
      expect(puzzle.themes?.includes(theme)).toBe(themed.includes(puzzle.id));
    expect(pool.length).toBeGreaterThan(themed.length);
    for (const first of themed)
      for (const second of themed.filter((id) => id !== first))
        expect(
          themed.filter((id) => id !== first && id !== second).length
        ).toBeGreaterThan(0);
  });
