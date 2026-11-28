import { expect, type Page, test } from '@playwright/test';

test.use({ trace: 'on', hasTouch: true });

async function openStory(page: Page, id: string) {
  await page.goto(`/iframe.html?id=${id}&viewMode=story`);
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await page.evaluate(() => document.fonts.ready);
}

async function box(page: Page, selector: string, index = 0) {
  const rect = await page.locator(selector).nth(index).boundingBox();
  if (!rect) throw new Error(`Missing ${selector}`);
  return rect;
}

/** The board, both seats and the way to the commands in view, side by side. */
async function checkLandscapeFrame(page: Page) {
  await page.setViewportSize({ width: 844, height: 390 });
  await openStory(page, 'screens-games-chess-board--your-turn');
  const board = await box(page, '[data-game-board]');
  for (const seat of await page
    .locator('[data-component="GamePlayerBar"]')
    .all()) {
    await expect(seat).toBeInViewport({ ratio: 1 });
    const bounds = await seat.boundingBox();
    expect(bounds && bounds.y + bounds.height).toBeLessThanOrEqual(board.y);
  }
  // The readable board scrolls within its room if a short screen cannot fit all ranks.
  const actions = await box(page, '[data-testid="game-session-commands"]');
  expect(actions.y).toBeGreaterThanOrEqual(board.y + board.height - 1);
  expect(actions.y + actions.height).toBeLessThanOrEqual(390);
  for (const square of ['a1', 'h8']) {
    const cell = page.locator(`[data-square="${square}"]`);
    await cell.scrollIntoViewIfNeeded();
    await expect(cell).toBeInViewport({ ratio: 1 });
    expect(
      (await box(page, `[data-square="${square}"]`)).width
    ).toBeGreaterThanOrEqual(32);
    expect(await box(page, '[data-testid="game-session-commands"]')).toEqual(
      actions
    );
  }
}

// regression: game-frame-board-below-short-landscape-fold
test('storybook integration: chess game frame 844x390 keeps board, seats and actions in view', async ({
  page,
}) => {
  await checkLandscapeFrame(page);
});
