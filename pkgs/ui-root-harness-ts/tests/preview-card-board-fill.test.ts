import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const UI_SRC = join(import.meta.dirname, '../../ui-root-client-ts/src');

function css(file: string): string {
  return readFileSync(join(UI_SRC, file), 'utf8');
}

/** The declarations of the first rule whose selector is exactly `selector`, from `from` on. */
function rule(file: string, selector: string, from = 0): string {
  const text = css(file);
  const start = text.indexOf(`${selector} {`, from);
  if (start < 0) throw new Error(`${selector} has no rule`);
  return text.slice(start, text.indexOf('}', start));
}

// regression: content-library-boards-tiny-in-cards — a library card's
// picture was 16:10, but its board was laid out in a square on the
// picture's shorter side, at the board's own 44px tile cap, so the board
// filled about a third of the picture and the cards were mostly empty
// well. In a card's picture the board now spans the whole area, fits its
// height as well as its width with no tile cap, and the picture is 2:1.
test("a card's board fills its picture: the whole area, fitted to its height", () => {
  const thumbnail = 'preview-thumbnail/preview-thumbnail.module.css';
  const tall = css(thumbnail).indexOf('@container (min-height: 6rem)');
  expect(tall).toBeGreaterThan(0);
  const content = rule(
    thumbnail,
    '.thumbnail[data-size="fill"] .content',
    tall
  );
  expect(content).toMatch(/width:\s*100cqi;/);
  expect(content).toMatch(/height:\s*100cqb;/);
  expect(content).toMatch(/--board-fit-block-size:\s*calc\(100cqb/);
  expect(content).toMatch(/--board-fit-tile-max:\s*100cqi;/);

  // Each board a card can draw reads the fit: Sokoban's tiles, Numberlink's paths.
  const tiles = rule('tile-board/tile-board.module.css', '.board', 1);
  expect(tiles).toMatch(/var\(--board-fit-tile-max, 2\.75rem\)/);
  expect(tiles).toMatch(/max-width:\s*calc\(\s*var\(--board-fit-block-size\)/);
  const paths = css('path-grid-board/path-grid-board.module.css');
  expect(paths).toMatch(/max-width:\s*calc\(\s*var\(--board-fit-block-size\)/);

  const grid = css('preview-card-grid/preview-card-grid.module.css');
  const wide = grid.indexOf('@container preview-card-grid (min-width: 640px)');
  expect(
    rule(
      'preview-card-grid/preview-card-grid.module.css',
      '  .section:not([data-layout="rows"]) .picture',
      wide
    )
  ).toMatch(/aspect-ratio:\s*2 \/ 1;/);
});

// regression: library-dark-previews-dimmed — a library card's board was
// drawn as a disabled board, at 70% opacity, so over the dark theme's
// picture well its cream floor turned a muddy tan. A preview's picture is
// still, not waiting on play: it is drawn at full strength in both themes.
test("a card's board is drawn at full strength, not dimmed as a waiting board", () => {
  const tiles = rule(
    'tile-board/tile-board.module.css',
    '.board[data-disabled="true"]'
  );
  expect(tiles).toMatch(/opacity:\s*var\(--board-still-opacity, 0\.7\);/);
  const content = rule(
    'preview-thumbnail/preview-thumbnail.module.css',
    '\n.content'
  );
  expect(content).toMatch(/--board-still-opacity:\s*1;/);
});

// regression: library-desktop-cards-uneven — wide, a library's cards took
// their own content's height row by row, and the Continue tab's two cards
// filled two of three columns with pictures tall enough to push Finished
// below the fold. Every row of cards is as tall as the tallest, and a
// `rows` grid keeps its compact rows wide, two columns of them.
test('wide, cards are one height, and a rows grid stays compact rows', () => {
  const file = 'preview-card-grid/preview-card-grid.module.css';
  const wide = css(file).indexOf(
    '@container preview-card-grid (min-width: 640px)'
  );
  expect(rule(file, '  .grid', wide)).toMatch(/grid-auto-rows:\s*1fr;/);
  expect(rule(file, '  .section[data-layout="rows"] .grid', wide)).toMatch(
    /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/
  );
  // Only cards turn their picture across the card; rows keep 64px.
  expect(css(file).slice(wide)).not.toMatch(/\n  \.picture \{/);
});
