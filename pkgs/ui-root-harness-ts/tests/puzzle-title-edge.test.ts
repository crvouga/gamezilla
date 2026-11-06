import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// regression: puzzle-title-off-breadcrumb — wide, the puzzle screen's grid
// (board and panel) was centred in the whole frame, so its "Puzzles" title
// and board began 10px right of the space bar's breadcrumb above. A square
// board's grid now takes the game column's width (a board's measure, the
// gap and the rail) and starts at that column's edge.
test("a square puzzle's grid starts on the game column's edge", () => {
  const css = readFileSync(
    join(
      import.meta.dirname,
      '../../ui-root-client-ts/src/screen-layouts.module.css'
    ),
    'utf8'
  );
  const wide = css.slice(
    css.indexOf('@container puzzle-frame (min-width: 880px)')
  );
  const start = wide.indexOf('.puzzle[data-square="true"] {');
  expect(start).toBeGreaterThan(-1);
  const square = wide.slice(start, wide.indexOf('\n  }', start));
  expect(square).toMatch(
    /max-width:\s*calc\(560px \+ var\(--ui-space-6\) \+ var\(--puzzle-panel-measure\)\);/
  );
  expect(square).toMatch(/justify-content:\s*start;/);
});
