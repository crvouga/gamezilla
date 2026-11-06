import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(import.meta.dirname, '../../ui-root-client-ts/src');

/** The `clamp(…)` a declaration of `property` sets after `from` in `css`. */
function clampAfter(css: string, from: string, property: string): string {
  const start = css.indexOf(property, css.indexOf(from));
  const open = css.indexOf('clamp(', start);
  let depth = 0;
  for (let at = open; at < css.length; at++) {
    if (css[at] === '(') depth++;
    if (css[at] === ')') depth--;
    if (depth === 0) return css.slice(open, at + 1).replace(/\s+/g, ' ');
  }
  throw new Error(`no clamp for ${property}`);
}

// regression: board-measure-mismatch — at one window a chess game's board
// was 540px and a chess puzzle's 560px: the game sized its board to the
// window's height less its chrome, the puzzle by its own rule. A square
// puzzle board now takes the game board's measure.
test("a square puzzle board takes a game board's measure", () => {
  const game = readFileSync(join(SRC, 'game-ui.module.css'), 'utf8');
  const puzzle = readFileSync(join(SRC, 'screen-layouts.module.css'), 'utf8');
  const gameMeasure = clampAfter(
    game,
    '@container game-column (min-width: 880px)',
    '--game-board-measure'
  );
  const puzzleMeasure = clampAfter(
    puzzle,
    '.puzzle[data-square="true"]',
    '--puzzle-board-block'
  );
  const normalise = (measure: string) =>
    measure.replace(
      'var(--game-board-chrome-block, 284px)',
      'var(--game-board-chrome-block)'
    );
  expect(normalise(puzzleMeasure)).toBe(normalise(gameMeasure));
  expect(game).toContain('--game-board-chrome-block: 284px;');
});
