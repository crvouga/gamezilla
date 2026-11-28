import { expect, test } from '@playwright/test';
import { timingTrace } from '../../../storybook/timing-trace';
import { openSokoban } from '../sokoban-overhaul/evidence';
import { solveAndRecover } from '../sokoban-overhaul/solve-and-recover';

const viewport = { width: 768, height: 1024 };
test.use({
  viewport,
  video: { mode: 'on', size: viewport },
  trace: timingTrace,
});

test('storybook integration: Sokoban overhaul solve and recover 768', async ({
  page,
}, info) => {
  await solveAndRecover(page, info, viewport);
});

// regression: sokoban-tablet-board-leaves-empty-strip
test('storybook integration: Sokoban tablet board sits centred in its column', async ({
  page,
}) => {
  await openSokoban(page, 'puzzle--fresh');
  const warehouse = page.getByTestId('sokoban-board');
  const layout = await page
    .locator('[data-game-board]')
    .filter({ has: warehouse })
    .boundingBox();
  const board = await warehouse.boundingBox();
  if (!layout || !board) throw new Error('The layout or board is missing');
  const before = board.x - layout.x;
  const after = layout.x + layout.width - (board.x + board.width);
  expect(Math.abs(before - after)).toBeLessThanOrEqual(1);
});
