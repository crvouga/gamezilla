import { expect, type Page, test } from '@playwright/test';

test.use({ video: 'on', trace: 'on' });

async function boardTop(page: Page, story: string): Promise<number> {
  await page.goto(
    `/iframe.html?id=screens-games-connect-four-board--${story}&viewMode=story&globals=theme:light`
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await expect(page.getByTestId('custom-game-record')).toBeVisible();
  return page
    .getByTestId('custom-game-board')
    .evaluate((board) => board.getBoundingClientRect().top + window.scrollY);
}

// regression: phone-strip-first-move-reflow
test('storybook integration: the phone record strip keeps the board in place from no moves to the first moves', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // Opening has no moves ("No moves yet."); Drop a disc's play records moves.
  const empty = await boardTop(page, 'opening');
  await expect(page.getByTestId('custom-game-move-strip')).toHaveText(
    'No moves yet.'
  );
  const played = await boardTop(page, 'drop-a-disc');
  await expect(page.getByTestId('custom-game-move-strip')).not.toHaveText(
    'No moves yet.'
  );
  expect(played).toBe(empty);
});
