import { expect, test } from '@playwright/test';
import {
  accessibility,
  capture,
  center,
  mousePath,
  openBoard,
} from '../numberlink-board/evidence';

test.use({ video: 'on', trace: 'on' });

for (const theme of ['light', 'dark']) {
  test(`storybook integration: numberlink-recovery editor selection ${theme}`, async ({
    page,
  }, info) => {
    await openBoard(
      page,
      theme,
      'screens-games-numberlink-editor--five-by-five'
    );
    await capture(page, info, 'first-endpoint-selected');
    await page.getByRole('radio', { name: 'Second endpoint' }).click();
    await capture(page, info, 'second-endpoint-selected');
    await accessibility(page, info);
    await expect(page.getByTestId('numberlink-board-cell-13')).toHaveAttribute(
      'aria-current',
      'true'
    );
  });

  test(`storybook integration: numberlink-recovery stationary tap ${theme}`, async ({
    page,
  }, info) => {
    await openBoard(page, theme);
    await mousePath(page, [0, 1, 2, 3, 8, 13]);
    await capture(page, info, 'connected-before-tap');
    await page.getByTestId('numberlink-board-cell-0').click();
    await capture(page, info, 'after-stationary-tap');
    await expect(page.getByTestId('numberlink-progress')).toContainText(
      '1/5 pairs connected'
    );
  });

  test(`storybook integration: numberlink-recovery outside and reentry ${theme}`, async ({
    page,
  }, info) => {
    await openBoard(page, theme);
    const start = await center(page, 0);
    const middle = await center(page, 1);
    const board = await page.getByTestId('numberlink-board').boundingBox();
    if (!board) throw new Error('Missing Numberlink board');
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(middle.x, middle.y);
    await capture(page, info, 'before-leaving-board');
    await page.mouse.move(middle.x, board.y - 8);
    for (const index of [3, 8, 13]) {
      const point = await center(page, index);
      await page.mouse.move(point.x, point.y);
    }
    await page.mouse.up();
    await capture(page, info, 'after-reentry');
    await expect(
      page.getByTestId('numberlink-board-cell-1')
    ).toHaveAccessibleName('B1: empty');
  });

  test(`storybook integration: numberlink-recovery Escape during mouse drawing ${theme}`, async ({
    page,
  }, info) => {
    await openBoard(page, theme);
    const start = await center(page, 0);
    const middle = await center(page, 1);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(middle.x, middle.y);
    await capture(page, info, 'before-escape');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await capture(page, info, 'after-escape');
    await expect(
      page.getByTestId('numberlink-board-cell-1')
    ).toHaveAccessibleName('B1: empty');
  });
}
