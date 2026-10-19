/**
 * The pool "puzzles with and without a theme of the game's known puzzle"
 * describes, made of the game's own puzzles: every known puzzle with the
 * theme and one of its more puzzles without it.
 *
 * Three with the theme, because a scenario that limits the feed and then
 * moves on may already have used two: the first puzzle served, before the
 * feed was limited, may be one with the theme, and limiting puts another on
 * the board. Which puzzle the feed serves first is the product's choice (its
 * pick depends on the person's id), so the pool leaves one to move on to
 * whatever it served.
 */
import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import type { PuzzleFixture } from '@libs/game-session-harness/known-puzzles';
import { chosenFeedTheme } from '@libs/game-session-harness/puzzle-feed-choices';
import { theKnownPuzzle } from '@libs/game-session-harness/puzzle-moves';
import type { PoolPuzzle } from '@libs/game-session-harness/puzzle-pool';
import { themesWith } from './puzzle-world';

export type ThemePool = {
  readonly theme: string;
  readonly pool: readonly PoolPuzzle[];
  readonly themed: readonly string[];
};

export function themePool(game: HarnessGame): ThemePool {
  const theme = chosenFeedTheme(game);
  const known = theKnownPuzzle(game);
  const others = (game.fixtures.puzzles ?? []).filter(
    (fixture) => fixture.record.id !== known.record.id
  );
  const [second, third] = others;
  const [without] = game.fixtures.morePuzzles ?? [];
  if (second === undefined || third === undefined || without === undefined)
    throw new Error(
      `${game.label}: a pool with and without the theme needs three known puzzles and one more puzzle`
    );
  const entries: readonly (readonly [PuzzleFixture, boolean])[] = [
    [known, true],
    [second, true],
    [third, true],
    [without, false],
  ];
  return {
    theme,
    pool: entries.map(([fixture, themed]) => ({
      id: fixture.record.id,
      themes: themesWith(fixture.record.themes, theme, themed),
    })),
    themed: entries
      .filter(([, themed]) => themed)
      .map(([fixture]) => fixture.record.id),
  };
}
