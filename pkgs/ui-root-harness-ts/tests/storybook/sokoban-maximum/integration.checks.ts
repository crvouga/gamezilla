import { expect, test } from '@playwright/test';
import {
  accessibility,
  capture,
  counts,
  openSokoban,
} from '../sokoban-overhaul/evidence';
import { measureSokoban } from '../sokoban-overhaul/responsiveness';

const viewport = { width: 390, height: 844 };
test.use({ viewport, video: { mode: 'on', size: viewport }, trace: 'on' });

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

// regression: sokoban-move-rebuilds-every-tile
test('storybook integration: Sokoban dense maximum board input and frame evidence', async ({
  page,
}, info) => {
  await openSokoban(page, 'puzzle--dense-maximum-board', 'light');
  const board = page.getByTestId('sokoban-board');
  await expect(board.getByRole('img')).toHaveCount(400);
  await capture(page, info, 'dense-maximum-board');
  await measureSokoban(page, info, 4, 0);
  await capture(page, info, 'dense-maximum-board-after-movement');
  await accessibility(page, info);
});
