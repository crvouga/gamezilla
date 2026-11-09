import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const UI_SRC = join(import.meta.dirname, '../../../pkgs/ui-root-client-ts/src');
const read = (file: string): string => readFileSync(join(UI_SRC, file), 'utf8');

/** The body of the first rule whose selector is exactly `selector`. */
function rule(css: string, selector: string): string {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) throw new Error(`no rule ${selector}`);
  const open = css.indexOf('{', at);
  return css.slice(open + 1, css.indexOf('}', open));
}

// regression: battleship-hit-faint-light — in the light theme a hit was the
// app's pale destructive wash with a thin red edge, hard to tell from an
// untouched square. A hit is now the hit fill itself with its cross in the
// fill's own ink, in both themes; a sunk ship adds the heavy ring.
test('a Battleship hit is a solid mark in both themes', () => {
  const css = read('cell-grid-board/cell-grid-board.module.css');
  const own = read('cell-grid-board/cell-grid-board-battleship.module.css');
  const hit = rule(
    own,
    '.board[data-board-theme="battleship"] .cell[data-tone="alert"],\n.legendMark[data-tone="alert"]'
  );
  expect(hit).toMatch(/background:\s*var\(--color-destructive\);/);
  expect(hit).toMatch(/color:\s*var\(--color-on-destructive\);/);
  expect(hit).not.toContain('destructive-surface');
  expect(rule(css, '.cell[data-outlined="true"]')).toMatch(
    /border-width:\s*3px;/
  );
});

// regression: battleship-sunk-and-latest-shot-look-alike — a sunk square
// was the hit fill plus a heavy ink border, and the latest shot wore a heavy
// ink ring too, so "my last shot" read as "sunk" and sunk barely differed
// from hit. Sunk is now its own fill (the board's ink, cross in the water's
// colour); the latest shot wears the accent ring, never the ink.
test('sunk is its own fill and the latest shot never wears the sunk ink', () => {
  const own = read('cell-grid-board/cell-grid-board-battleship.module.css');
  const sunk = rule(
    own,
    '.board[data-board-theme="battleship"] .cell[data-tone="critical"],\n.legendMark[data-tone="critical"]'
  );
  expect(sunk).toMatch(/background:\s*var\(--color-text\);/);
  expect(sunk).toMatch(/color:\s*var\(--color-background\);/);
  expect(sunk).not.toContain('destructive');
  const latest = rule(
    own,
    '.board[data-board-theme="battleship"] .cell[data-emphasis="recent"]'
  );
  expect(latest).toMatch(/outline:\s*3px solid var\(--color-tint\);/);
  expect(latest).not.toContain('--color-text');
});

// regression: battleship-board-small-wide — wide, the 10×10 board was held
// to about 440px by the room it left under it for the panel switch and the
// key, though the window still had room to spare below the person's own
// seat. It now leaves only what those take, so the board grows.
test('wide, the Battleship board leaves only the room its switch and key take', () => {
  const css = read('game-ui.module.css');
  const paired = css.slice(css.indexOf('.stage [data-paired-panels]'));
  // The switch, the key and the Fire row (44px) under the whole board.
  expect(paired).toMatch(
    /--game-board-chrome-block: calc\(328px \+ 2 \* var\(--ui-space-12\)\);/
  );
});
