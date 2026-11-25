import { expect, type Page, test } from '@playwright/test';
import {
  capture,
  center,
  mousePath,
  openBoard,
} from '../numberlink-board/evidence';

test.use({ hasTouch: true, video: 'on', trace: 'on' });

async function pinchAcrossTrace(page: Page) {
  const session = await page.context().newCDPSession(page);
  const start = await center(page, 0);
  const loose = await center(page, 1);
  const other = await center(page, 7);
  const touch = (
    type: 'touchStart' | 'touchMove' | 'touchEnd',
    touchPoints: { x: number; y: number; id: number }[]
  ) => session.send('Input.dispatchTouchEvent', { type, touchPoints });
  try {
    await touch('touchStart', [{ ...start, id: 1 }]);
    await touch('touchMove', [{ ...loose, id: 1 }]);
    await touch('touchStart', [
      { ...loose, id: 1 },
      { ...other, id: 2 },
    ]);
    for (const delta of [8, 16, 24, 32]) {
      await touch('touchMove', [
        { x: loose.x - delta, y: loose.y, id: 1 },
        { x: other.x + delta, y: other.y, id: 2 },
      ]);
    }
    await touch('touchEnd', []);
  } finally {
    await session.detach();
  }
}

async function trackpadAcrossTrace(page: Page) {
  const start = await center(page, 0);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const next = await center(page, 1);
  await page.mouse.move(next.x, next.y);
  await page.keyboard.down('Control');
  try {
    await page.mouse.wheel(0, -60);
  } finally {
    await page.keyboard.up('Control');
  }
  await page.mouse.up();
  await page.mouse.wheel(12, 8);
}

for (const width of [390, 1440]) {
  test.describe(`Numberlink board inspection at ${width}`, () => {
    test.use({
      viewport: { width, height: width === 390 ? 844 : 1024 },
      video: {
        mode: 'on',
        size: { width, height: width === 390 ? 844 : 1024 },
      },
    });
    test('storybook integration: numberlink-gestures inspect, fit and draw', async ({
      page,
    }, info) => {
      await openBoard(page, 'light');
      const board = page.getByTestId('numberlink-board');
      const first = page.getByTestId('numberlink-board-cell-0');
      const fit = await first.boundingBox();
      if (!fit) throw new Error('Missing first endpoint');
      await capture(page, info, 'fit');
      if (width === 390) await pinchAcrossTrace(page);
      else await trackpadAcrossTrace(page);
      await capture(page, info, 'inspection');
      const enlarged = await first.boundingBox();
      expect(enlarged?.width).toBeGreaterThan(fit.width * 1.1);
      await expect(board.locator('[data-path]')).toHaveCount(0);
      // Use the transformed hit target before returning to fit.
      await mousePath(page, [1, 0]); // an empty start cannot commit
      await expect(board.locator('[data-path]')).toHaveCount(0);
      await page.keyboard.press('0');
      await expect
        .poll(async () => (await first.boundingBox())?.width)
        .toBe(fit.width);
      await mousePath(page, [0, 1, 2, 1]);
      const tip = board.locator('circle');
      await expect(tip).toHaveCount(1);
      await capture(page, info, 'corrected');
      await mousePath(page, [0, 1, 2, 3, 8, 13]);
      await expect(tip).toHaveCount(0);
      await expect(
        page.getByTestId('numberlink-board-cell-13')
      ).toHaveAccessibleName('D3: endpoint 1, connected');
      await capture(page, info, 'joined');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(first.locator('[data-shape]')).toHaveCSS(
        'transition-duration',
        '0s'
      );
    });
  });
}
