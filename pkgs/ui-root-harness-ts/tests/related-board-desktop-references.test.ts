import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(import.meta.dirname, '../../ui-root-client-ts/src');

/** Related board components and the stories opened at both widths. */
const RELATED = [
  ['card-table/card-table.stories.tsx', 'product-cardtable', ['states']],
  [
    'cell-grid-board/board-boundary-contrast.stories.tsx',
    'games-cellgridboard-boundary-contrast',
    ['open-water'],
  ],
  [
    'cell-grid-board/cell-grid-board.stories.tsx',
    'product-cellgridboard',
    ['states'],
  ],
  [
    'paddle-court/paddle-court.stories.tsx',
    'components-inputs-paddlecourt',
    ['states'],
  ],
  [
    'trail-arena/trail-arena.stories.tsx',
    'components-inputs-trailarena',
    ['states'],
  ],
  [
    'word-tile-board/word-tile-board.stories.tsx',
    'product-wordtileboard',
    ['states', 'enlarged-placement'],
  ],
] as const;

// regression: storybook-related-board-desktop-unowned — a Playwright loop
// opened these stories at 1440 outside the story matrix, so most of them were
// never checked at desktop width. Each story is responsive itself.
test('related board components are opened at desktop width beside the phone one', () => {
  for (const [stories, , names] of RELATED) {
    const file = join(SRC, stories);
    const source = readFileSync(file, 'utf8');
    expect(source.match(/tags: \['viewport-responsive'\]/g)?.length).toBe(
      names.length
    );
  }
});
