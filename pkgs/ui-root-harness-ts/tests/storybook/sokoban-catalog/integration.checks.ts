import { expect, test } from '@playwright/test';
import { capture, counts, openSokoban } from '../sokoban-overhaul/evidence';

test.use({ viewport: { width: 390, height: 844 } });

test('storybook integration: play Sokoban catalog from Receiving dock', async ({
  page,
}, info) => {
  await openSokoban(page, 'catalog--first-warehouse', 'light');
  const board = page.getByTestId('sokoban-board');
  await expect(board).toBeVisible();
  await expect(
    page.getByText('Dock 01', { exact: true }).first()
  ).toBeVisible();
  await counts(page, 0, 0);
  await capture(page, info, 'sokoban-catalog-start');

  for (const key of [
    'ArrowRight',
    'ArrowUp',
    'ArrowRight',
    'ArrowUp',
    'ArrowLeft',
  ])
    await board.press(key);
  await counts(page, 5, 2);
  await expect(page.getByTestId('sokoban-solved')).toBeVisible();
  await capture(page, info, 'sokoban-catalog-solved');

  await page.getByTestId('content-open-progress').click();
  await expect(page.getByTestId('puzzle-attempt-pack-place')).toHaveText(
    'Puzzle 1 of 64 in Receiving dock'
  );
  await expect(page.getByTestId('content-next-puzzle')).toHaveText(
    'Next puzzle: Dock 02'
  );
  await capture(page, info, 'sokoban-catalog-pack');
});
