import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

// regression: storybook-parent-directory-glob-indexing
test('the public Storybook index includes stories from both owning harnesses', () => {
  const index = JSON.parse(
    readFileSync(
      new URL('../.cache/storybook/index.json', import.meta.url),
      'utf8'
    )
  ) as { entries: Record<string, { importPath: string }> };
  expect(
    index.entries['components-inputs-actionbar--states']?.importPath
  ).toContain('action-bar.stories.tsx');
  expect(index.entries['product-chessboard--initial']?.importPath).toContain(
    'chess-board.stories.tsx'
  );
});
