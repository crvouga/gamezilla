import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path: string) =>
  readFileSync(join(import.meta.dir, '../src', path), 'utf8');

/** The body of the first block opened by `query`, braces balanced. */
function block(sheet: string, query: string): string {
  const start = sheet.indexOf(query);
  expect(start).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let at = sheet.indexOf('{', start); at < sheet.length; at += 1) {
    if (sheet[at] === '{') depth += 1;
    if (sheet[at] === '}') depth -= 1;
    if (depth === 0) return sheet.slice(start, at);
  }
  throw new Error(`Unclosed block: ${query}`);
}

const px = (text: string | undefined): number => {
  expect(text).toBeDefined();
  return Number.parseFloat(text ?? 'NaN');
};

/** The desktop window the stories capture, and the screen's own top bar. */
const WINDOW = 900;
const HOST = 52 + 8;

/**
 * A square of a nine-column Quoridor board `width` wide: the padding (8px
 * each side), nine 2px gaps and a row-label column of 0.6 of a square.
 */
const square = (width: number) => (width - 16 - 9 * 2) / 9.6;

// regression: quoridor-hill-desktop-board-below-target-size — beside the
// record rail the Quoridor board kept a 440px height allowance meant for a
// stacked tablet column, so at 1440x900 it stopped at 400px with 37px
// squares (34px at a phone-height frame), short of the 440px board and
// 44px squares its wall journeys need; Classic and King of the Hill alike.
test('beside the rail, a 1440x900 window gives the Quoridor board 44px squares', () => {
  const cells = read('cell-grid-board/cell-grid-board.module.css');
  const desktop = block(cells, '@container game-column (min-width: 880px)');
  expect(desktop).toContain('[data-board-theme="quoridor"]');
  const chrome = px(/--chrome: (\d+)px;/.exec(desktop)?.[1]);
  const fit = WINDOW - chrome - HOST;
  const frame = read('game-session-layout/game-session-layout.module.css');
  const active = block(frame, '[data-phase="active"]');
  const column = Math.min(
    640,
    WINDOW - px(/100dvh - (\d+)px/.exec(active)?.[1]) - HOST
  );
  const board = Math.min(column, fit);
  expect(board).toBeGreaterThanOrEqual(440);
  expect(square(board)).toBeGreaterThanOrEqual(44);
});
