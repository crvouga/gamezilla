import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PuzzleScreen } from '@pkgs/ui-root-client-ts/puzzle-screen';
import { createSignal } from 'solid-js';
import { renderUi } from './render';

// regression: ui-puzzle-invalid-board-ratio
test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
  'invalid board ratio %s is refused instead of producing invalid CSS',
  (ratio) => {
    let message = '';
    try {
      renderUi(() => (
        <PuzzleScreen screenId="invalid" boardAspectRatio={ratio}>
          <p>Board</p>
        </PuzzleScreen>
      ));
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toBe('Board aspect ratio must be finite and positive');
  }
);

test('rectangular boards update without remounting and own their overlays and controls', () => {
  const [ratio, setRatio] = createSignal(1);
  const view = renderUi(() => (
    <PuzzleScreen
      screenId="puzzle"
      boardAspectRatio={ratio()}
      header={<p>Feed</p>}
      timeline={<button type="button">Back one move</button>}
      actions={<button type="button">Next puzzle</button>}
      overlay={<p role="status">Solved</p>}
    >
      <input aria-label="Board" />
    </PuzzleScreen>
  ));
  const board = view.getByRole('textbox');
  const fitted = () =>
    view.container.querySelector<HTMLElement>(
      '[style*="--ui-play-aspect-ratio"]'
    );
  expect(fitted()?.style.getPropertyValue('--ui-play-aspect-ratio')).toBe('1');
  setRatio(7 / 6);
  expect(fitted()?.style.getPropertyValue('--ui-play-aspect-ratio')).toBe(
    String(7 / 6)
  );
  expect(view.getByRole('textbox')).toBe(board);
  expect(
    fitted()?.contains(view.getByRole('button', { name: 'Next puzzle' }))
  ).toBe(false);
  expect(
    view.container
      .querySelector('[data-screen="puzzle"]')
      ?.contains(view.getByRole('status'))
  ).toBe(true);
});

// regression: puzzle-phone-moves-split-actions — on a phone the move list
// and its steps sat between the board and Hint / Skip puzzle, so the
// actions on the puzzle came after moving through its line. The actions
// now come right under the board (and its legend), the move list after.
test('the actions come right after the board, the move list after them', () => {
  const view = renderUi(() => (
    <PuzzleScreen
      screenId="puzzle"
      legend={<p>Legend</p>}
      timeline={<p>Moves</p>}
      actions={<p>Hint</p>}
    >
      <p>Board</p>
    </PuzzleScreen>
  ));
  const names = [
    ...(view.container.querySelector('[data-component="PuzzleScreen"]')
      ?.children ?? []),
  ]
    .map((child) => child.getAttribute('data-component'))
    .filter((name) => name !== null);
  const order = names.filter((name) =>
    ['PuzzleLegend', 'PuzzleActions', 'PuzzleTimeline'].includes(name)
  );
  expect(order).toEqual(['PuzzleLegend', 'PuzzleActions', 'PuzzleTimeline']);
});

// regression: puzzle-panel-short-of-column-edge — wide, a chess puzzle's
// panel was a fixed 376px beside a board the window held under 560px, so
// its right edge stopped 20px short of the column's (1300px, not 1320px,
// at 1440px). A square board's panel now takes the rest of the column.
test("wide, a square board's panel takes the rest of its column", () => {
  const css = readFileSync(
    join(
      import.meta.dirname,
      '../../ui-root-client-ts/src/screen-layouts.module.css'
    ),
    'utf8'
  );
  const square = css.indexOf('  .puzzle[data-square="true"] {');
  expect(square).toBeGreaterThan(0);
  const body = css.slice(square, css.indexOf('\n  }', square));
  expect(body).toMatch(
    /grid-template-columns:\s*min\(\s*var\(--puzzle-board-block\),[^;]*\)\s*minmax\(var\(--puzzle-panel-measure\), 1fr\);/
  );
  expect(body).toMatch(/justify-content:\s*start;/);
});
