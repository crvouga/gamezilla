import { expect, test } from '@playwright/test';
import { accessibility, capture, counts, openSokoban } from './evidence';
import { measureSokoban } from './responsiveness';

test.use({ trace: 'on' });

for (const viewport of [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
]) {
  test.describe(`Sokoban ${viewport.width}px recording`, () => {
    test.use({ viewport, video: { mode: 'on', size: viewport } });
    for (const theme of ['light', 'dark']) {
      test(`storybook integration: Sokoban overhaul solve and recover ${viewport.width}/${theme}`, async ({
        page,
      }, info) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await openSokoban(page, 'puzzle--fresh', theme);
        await capture(page, info, 'fresh');
        const board = page.getByTestId('sokoban-board');
        await board.focus();
        await board.press('ArrowLeft');
        await expect(page.getByTestId('sokoban-refusal')).toBeVisible();
        await counts(page, 0, 0);
        await capture(page, info, 'blocked');
        await board.press('ArrowRight');
        await board.press('d');
        await counts(page, 2, 2);
        await capture(page, info, 'first-crate-on-goal');
        await measureSokoban(page, info, viewport.width === 390 ? 4 : 1);
        await page
          .getByRole('button', { name: 'Restart', exact: true })
          .click();
        await counts(page, 0, 0);
        await board.focus();
        await board.press('ArrowRight');
        await page.getByRole('button', { name: 'Undo', exact: true }).click();
        await counts(page, 0, 0);
        await expect(page.getByTestId('sokoban-refusal')).toHaveCount(0);
        await page.getByRole('button', { name: 'Redo', exact: true }).click();
        await counts(page, 1, 1);
        await board.focus();
        for (const key of ['d', 'a', 'a', 'w', 'd', 'd'])
          await board.press(key);
        await counts(page, 7, 4);
        await expect(page.getByTestId('sokoban-solved')).toBeVisible();
        await capture(page, info, 'solved');
        await page
          .getByRole('button', { name: 'Restart', exact: true })
          .click();
        await counts(page, 0, 0);
        await expect(page.getByTestId('sokoban-solved')).toHaveCount(0);
        await capture(page, info, 'restarted');
        await accessibility(page, info);
        expect(errors).toEqual([]);
      });
    }
  });
}
