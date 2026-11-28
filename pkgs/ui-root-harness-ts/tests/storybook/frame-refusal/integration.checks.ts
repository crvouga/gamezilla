import { expect, type Locator, type Page, test } from '@playwright/test';

test.use({ hasTouch: true });

type Box = { x: number; y: number; width: number; height: number };

async function box(locator: Locator): Promise<Box> {
  const value = await locator.boundingBox();
  if (value === null) throw new Error('Required game surface is missing');
  return value;
}

/** Whether two boxes share no area. */
function apart(a: Box, b: Box): boolean {
  return (
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

async function open(page: Page, story: string): Promise<void> {
  await page.goto(`/iframe.html?id=${story}&viewMode=story`);
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await page.evaluate(() => document.fonts.ready);
}

/** Where the board stage and the board itself lie once the story is ready. */
async function boardPlace(page: Page, story: string) {
  await open(page, story);
  const stage = await box(
    page.locator('[data-component="GameBoardStage"]').first()
  );
  const board = await box(page.locator('[data-game-board]').first());
  return { stage, board };
}

/** A refused choice can be dismissed without moving the board or its commands. */
async function expectDismissibleRefusal(
  page: Page,
  viewport: { width: number; height: number }
): Promise<void> {
  await page.setViewportSize(viewport);
  const retried = await boardPlace(
    page,
    'screens-game-sessions-stage--choice-retried'
  );
  await expect(page.getByTestId('game-session-error')).toHaveCount(0);
  const refused = await boardPlace(
    page,
    'screens-game-sessions-stage--choice-refused'
  );
  // The board is where it is once the choice is retried, to the pixel:
  // the refusal never takes a row of its own.
  expect(refused).toEqual(retried);
  // The refusal is shown and announced, in words.
  const alert = page.getByTestId('game-session-error');
  await expect(alert).toBeVisible();
  await expect(alert).toHaveAttribute('role', 'alert');
  await expect(alert).toContainText('That move is not legal in this position.');
  await expect(alert).toBeInViewport({ ratio: 1 });
  const shown = await box(alert);
  // The game's commands stay where they were, uncovered and usable.
  const commands = page.locator(
    '[data-component="GameActionBar"] button:visible'
  );
  expect(await commands.count()).toBeGreaterThan(0);
  for (const command of await commands.all()) {
    await expect(command).toBeInViewport({ ratio: 1 });
    expect(apart(await box(command), shown)).toBe(true);
  }
  await page.getByTestId('toast-dismiss').click();
  await expect(alert).toHaveCount(0);
  expect(await box(page.locator('[data-game-board]').first())).toEqual(
    refused.board
  );
}

// regression: frame-refusal-shifts-board
test('storybook integration: a refused choice clears without moving the board at 390', async ({
  page,
}) => {
  await expectDismissibleRefusal(page, { width: 390, height: 844 });
});

// regression: stage-notice-spills-over-rail
test('storybook integration: a refused choice keeps the commands uncovered, at 1440', async ({
  page,
}) => {
  await expectDismissibleRefusal(page, { width: 1440, height: 900 });
});
