import { expect, type Page, type TestInfo, test } from '@playwright/test';

const viewport = { width: 390, height: 844 };
test.use({ viewport, video: { mode: 'on', size: viewport } });

async function firstMove(
  page: Page,
  info: TestInfo,
  flow: { story: string; start: string; introduction: string }
) {
  await page.goto(
    `/iframe.html?id=${flow.story}&viewMode=story&globals=theme:dark`
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await page.evaluate(() => document.fonts.ready);
  const button = page.getByTestId(flow.start);
  await expect(button).toBeEnabled();
  await page.screenshot({ path: info.outputPath('1-ready.png') });
  await button.click();

  const board = page.getByTestId('custom-game-board');
  await expect(board).toBeVisible();
  expect(await page.getByTestId(flow.introduction).count()).toBe(0);
  await expect(page.getByText('Your turn.').first()).toBeVisible();
  await page.screenshot({ path: info.outputPath('2-board.png') });
  await page.getByTestId('custom-game-board-column-4').click();
  await expect(board.locator('[data-cell="3"]')).toHaveAttribute(
    'data-disc',
    '1'
  );
  await page.screenshot({ path: info.outputPath('3-first-move.png') });
}

// regression: ready-game-board-covered
test('storybook integration: ready game against a bot takes the first move', async ({
  page,
}, info) => {
  await firstMove(page, info, {
    story: 'screens-custom-games-setup--start-and-play',
    start: 'custom-game-start',
    introduction: 'custom-game-versus',
  });
});

// regression: matchmaking-first-turn-status-missing
test('storybook integration: ready game with a matched player takes the first move', async ({
  page,
}, info) => {
  await firstMove(page, info, {
    story: 'screens-matchmaking-home--find-and-play',
    start: 'multiplayer-find',
    introduction: 'multiplayer-versus',
  });
});
