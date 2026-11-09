import { expect, type Page, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

/** Where the board stage's top sits once the story is ready. */
async function boardTop(page: Page, story: string): Promise<number> {
  await page.goto(`/iframe.html?id=${story}&viewMode=story`);
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  const stage = await page
    .locator('[data-component="GameBoardStage"]')
    .first()
    .boundingBox();
  if (!stage) throw new Error(`${story} has no board stage`);
  return stage.y;
}

// regression: frame-refusal-shifts-board
test('storybook integration: a refused choice appears and clears without moving the board at 390', async ({
  page,
}) => {
  const retried = await boardTop(page, 'screens-games-frame--choice-retried');
  const refused = await boardTop(page, 'screens-games-frame--choice-refused');
  // The refusal is shown and announced, with the game's commands.
  const alert = page.getByTestId('custom-game-error');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText('That move is not legal in this position.');
  expect(refused).toBe(retried);
  const stage = await page
    .locator('[data-component="GameBoardStage"]')
    .first()
    .boundingBox();
  const shown = await alert.boundingBox();
  if (!stage || !shown) throw new Error('The board or the refusal is missing');
  expect(shown.y).toBeGreaterThanOrEqual(stage.y + stage.height);
});
