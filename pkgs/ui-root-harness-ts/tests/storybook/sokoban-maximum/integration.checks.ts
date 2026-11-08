import { expect, test } from '@playwright/test';
import {
  accessibility,
  capture,
  counts,
  openSokoban,
} from '../sokoban-overhaul/evidence';
import { measureSokoban } from '../sokoban-overhaul/responsiveness';

test.use({ video: 'on', trace: 'on' });

test('storybook integration: Sokoban maximum board input and frame evidence', async ({
  page,
}, info) => {
  await openSokoban(page, 'puzzle--maximum-board', 'dark');
  const board = page.getByTestId('sokoban-board');
  await expect(board.getByRole('img')).toHaveCount(400);
  await capture(page, info, 'maximum-board');
  await board.press('ArrowRight');
  await board.press('ArrowRight');
  await counts(page, 2, 2);
  await expect(page.getByTestId('sokoban-solved')).toBeVisible();
  await measureSokoban(page, info, 4);
  await capture(page, info, 'maximum-board-after-movement');
  await accessibility(page, info);
});

// regression: sokoban-maximum-board-pieces-too-small
test('storybook integration: Sokoban close view keeps maximum-board pieces readable at 320px', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 740 });
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
  await accessibility(page, info);
  await measureSokoban(page, info, 4, 6);
  await page.getByRole('button', { name: 'Show whole board' }).click();
  await expect(board.getByRole('img')).toHaveCount(400);
  await counts(page, 26, 6);
  await capture(page, info, 'overview-preserves-progress');
});
