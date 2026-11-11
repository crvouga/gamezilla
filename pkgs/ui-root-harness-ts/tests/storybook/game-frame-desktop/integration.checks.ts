import { expect, type Page, test } from '@playwright/test';

/** A desktop window as the preview defines it. */
const DESKTOP = { width: 1440, height: 900 };

async function open(page: Page, id: string) {
  await page.goto(`/iframe.html?id=${id}&viewMode=story&globals=theme:light`);
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await page.evaluate(() => document.fonts.ready);
}

/** Every element with `testId` ends inside the first view, before any scroll. */
async function inFirstView(page: Page, testId: string) {
  const box = await page.getByTestId(testId).first().boundingBox();
  if (box === null) throw new Error(`${testId} is not shown`);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(DESKTOP.height);
}

// At 1440x900 the board filled a 640px column, so the person's own seat
// with "Take back my side" and a watcher's "You're watching" notice fell
// below the window.
// regression: game-frame-desktop-own-seat-below-fold
test('storybook integration: game frame keeps the own seat, its actions and a watcher notice in a 1440x900 window', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  await open(page, 'screens-games-custom-play--stand-in');
  await inFirstView(page, 'custom-game-seat-near');
  await inFirstView(page, 'custom-game-reclaim');
  await open(page, 'screens-games-custom-play--watching');
  await inFirstView(page, 'custom-game-watching');
  await open(page, 'screens-games-custom-play--your-turn');
  await inFirstView(page, 'custom-game-seat-near');
  expect(
    await page.evaluate(() => document.scrollingElement?.scrollTop ?? 0)
  ).toBe(0);
});

// With the board bounded by the window, the board column kept its 1fr track
// and the record rail its fixed width, leaving about 200px of empty band
// between them at 1440x900.
// regression: game-frame-desktop-board-rail-gap
test('storybook integration: game frame rail sits beside the bounded board at 1440x900', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  await open(page, 'screens-games-custom-play--your-turn');
  const board = await page.getByTestId('custom-game-public').boundingBox();
  // The rail's Moves card.
  const record = await page
    .locator('[data-component="CustomGameReview"]')
    .first()
    .boundingBox();
  if (board === null || record === null) throw new Error('Frame not shown');
  expect(record.x - (board.x + board.width)).toBeLessThanOrEqual(48);
  expect(record.x + record.width).toBeLessThanOrEqual(DESKTOP.width);
});
