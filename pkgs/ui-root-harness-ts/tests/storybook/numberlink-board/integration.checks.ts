import { expect, test } from '@playwright/test';
import {
  accessibility,
  capture,
  mousePath,
  openBoard,
  touchPath,
} from './evidence';

test.use({ video: 'on', trace: 'on', hasTouch: true });

for (const width of [320, 390, 768, 1440])
  for (const theme of ['light', 'dark'])
    test(`storybook integration: numberlink-board native recovery ${width} ${theme}`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1024 });
      const failures: string[] = [];
      page.on('pageerror', (error) => failures.push(error.message));
      await openBoard(page, theme);
      await capture(page, info, 'fresh');
      await mousePath(page, [0, 1, 2, 1]);
      await expect(page.getByTestId('numberlink-board-cell-1')).toHaveAccessibleName(
        'B1: path 1, unfinished'
      );
      await expect(page.getByTestId('numberlink-board-cell-2')).toHaveAccessibleName(
        'C1: empty'
      );
      await capture(page, info, 'backtracked');
      await touchPath(page, [0, 1, 2, 3, 8, 13]);
      await expect(page.getByTestId('numberlink-progress')).toContainText(
        '1/5 pairs connected'
      );
      await capture(page, info, 'touch-connected');
      await page.getByRole('button', { name: 'Remove a path' }).click();
      await page.getByRole('option', { name: 'Remove path 1' }).click();
      await expect(page.getByTestId('numberlink-board-cell-1')).toHaveAccessibleName(
        'B1: empty'
      );
      const first = page.getByTestId('numberlink-board-cell-0');
      await first.focus();
      await page.keyboard.press('Enter');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('numberlink-board-cell-1')).toHaveAccessibleName(
        'B1: empty'
      );
      await first.focus();
      await page.keyboard.press('Enter');
      for (const key of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown'])
        await page.keyboard.press(key);
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('numberlink-progress')).toContainText(
        '1/5 pairs connected'
      );
      await capture(page, info, 'keyboard-connected');
      await accessibility(page, info);
      expect(failures).toEqual([]);
    });
