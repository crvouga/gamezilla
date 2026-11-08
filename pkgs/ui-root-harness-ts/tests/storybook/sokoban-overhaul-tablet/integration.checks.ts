import { expect, test } from '@playwright/test';
import { openSokoban } from '../sokoban-overhaul/evidence';
import { solveAndRecover } from '../sokoban-overhaul/solve-and-recover';

const viewport = { width: 768, height: 1024 };
test.use({ viewport, video: { mode: 'on', size: viewport }, trace: 'on' });

test('storybook integration: Sokoban overhaul solve and recover 768/light', async ({
  page,
}, info) => {
  await solveAndRecover(page, info, viewport, 'light');
});

test('storybook integration: Sokoban overhaul solve and recover 768/dark', async ({
  page,
}, info) => {
  await solveAndRecover(page, info, viewport, 'dark');
});

// regression: sokoban-tablet-board-leaves-empty-strip
test('storybook integration: Sokoban tablet board sits centred in its column', async ({
  page,
}) => {
  await openSokoban(page, 'puzzle--fresh', 'light');
  const layout = await page
    .locator('[data-component="GameLayout"]')
    .boundingBox();
  const board = await page.getByTestId('sokoban-board').boundingBox();
  if (!layout || !board) throw new Error('The layout or board is missing');
  const before = board.x - layout.x;
  const after = layout.x + layout.width - (board.x + board.width);
  expect(Math.abs(before - after)).toBeLessThanOrEqual(1);
});
