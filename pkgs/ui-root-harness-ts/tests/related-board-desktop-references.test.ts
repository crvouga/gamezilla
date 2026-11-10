import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(import.meta.dirname, '../../ui-root-client-ts/src');

/** Related board components and the stories that carry their desktop reference. */
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
// captured these stories at 1440 outside the story matrix, so Storybook
// coverage called the one authored set (the Pong court's) an orphan and the
// others were never authored. Each story is responsive itself, and both
// widths' references sit in its slice.
test('related board components own a desktop reference beside the phone one', () => {
  for (const [stories, component, names] of RELATED) {
    const file = join(SRC, stories);
    const source = readFileSync(file, 'utf8');
    expect(source.match(/tags: \['viewport-responsive'\]/g)?.length).toBe(
      names.length
    );
    const slice = join(file, '..', 'baselines/chromium', component);
    for (const name of names)
      for (const theme of ['light', 'dark'])
        for (const suffix of ['', '-1440'])
          expect(existsSync(join(slice, `${name}-${theme}${suffix}.png`))).toBe(
            true
          );
  }
});
