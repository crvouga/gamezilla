import { expect, type Page, test } from '@playwright/test';

test.use({ trace: 'on', hasTouch: true });

async function openStory(page: Page, id: string, theme: string) {
  await page.goto(
    `/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`
  );
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

/** The board, both seats, the strip and the actions in view, side by side. */
async function checkLandscapeFrame(page: Page, theme: string) {
  await page.setViewportSize({ width: 844, height: 390 });
  await openStory(page, 'screens-games-chess-board--your-turn', theme);
  const board = await box(page, '[data-component="ChessBoard"]');
  for (const square of ['a1', 'h1', 'a8', 'h8']) {
    const cell = await box(page, `[data-square="${square}"]`);
    expect(cell.width).toBeGreaterThanOrEqual(32);
    expect(cell.y).toBeGreaterThanOrEqual(0);
    expect(cell.y + cell.height).toBeLessThanOrEqual(390);
  }
  const beside = [
    await box(page, '[data-component="GameHeading"]'),
    await box(page, '[data-component="GameSessionPinned"]'),
    await box(page, '[data-component="GamePlayerBar"]', 0),
    await box(page, '[data-component="GamePlayerBar"]', 1),
  ];
  for (const name of [/^Offer draw/, /^Resign/]) {
    const action = await page.getByRole('button', { name }).boundingBox();
    if (!action) throw new Error(`Missing ${String(name)}`);
    beside.push(action);
  }
  for (const part of beside) {
    expect(part.x).toBeGreaterThanOrEqual(board.x + board.width);
    expect(part.y).toBeGreaterThanOrEqual(0);
    expect(part.y + part.height).toBeLessThanOrEqual(390);
  }
}

// regression: game-frame-board-below-short-landscape-fold
test('storybook integration: chess game frame 844x390 light keeps board, seats and actions in view', async ({
  page,
}) => {
  await checkLandscapeFrame(page, 'light');
});

test('storybook integration: chess game frame 844x390 dark keeps board, seats and actions in view', async ({
  page,
}) => {
  await checkLandscapeFrame(page, 'dark');
});
