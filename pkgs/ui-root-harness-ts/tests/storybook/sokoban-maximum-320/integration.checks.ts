import { expect, test } from '@playwright/test';
import {
  accessibility,
  capture,
  counts,
  openSokoban,
} from '../sokoban-overhaul/evidence';
import { measureSokoban } from '../sokoban-overhaul/responsiveness';

const viewport = { width: 320, height: 740 };
test.use({
  viewport,
  video: { mode: 'on', size: viewport },
  trace: 'on',
});

// regression: sokoban-close-view-builds-whole-board
// regression: sokoban-maximum-board-pieces-too-small
test('storybook integration: Sokoban close view keeps maximum-board pieces readable at 320px', async ({
  page,
}, info) => {
  await openSokoban(page, 'puzzle--maximum-board', 'light');
  const board = page.getByTestId('sokoban-board');
  await capture(page, info, 'maximum-overview-320');
  await page.getByRole('button', { name: 'Look closer' }).click();
  await expect(board.getByRole('img')).toHaveCount(36);
  const tile = await board.getByRole('img').first().boundingBox();
  if (!tile) throw new Error('Close-view tile is missing');
  expect(tile.width).toBeGreaterThanOrEqual(44);
  expect(tile.height).toBeGreaterThanOrEqual(44);
  await capture(page, info, 'maximum-close-320');
  for (let move = 0; move < 5; move++) await board.press('ArrowRight');
  await counts(page, 5, 5);
  await board.getByRole('img', { name: 'H2: floor, crate' }).click();
  await counts(page, 6, 6);
  await expect(
    board.getByRole('img', { name: 'H2: floor, worker' })
  ).toBeVisible();
  await capture(page, info, 'close-view-follows-worker');
  // Timed before the axe scan, as every other Sokoban suite does: the scan's
  // own garbage collection otherwise lands on the first timed moves.
  await measureSokoban(page, info, 4, 6);
  await accessibility(page, info);
  await page.getByRole('button', { name: 'Show whole board' }).click();
  await expect(board.getByRole('img')).toHaveCount(400);
  await counts(page, 26, 6);
  await capture(page, info, 'overview-preserves-progress');
});
