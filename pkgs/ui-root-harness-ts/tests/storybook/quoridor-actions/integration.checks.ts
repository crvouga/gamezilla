import { expect, type Page, test } from '@playwright/test';

for (const width of [390, 768, 1440]) {
  for (const theme of ['light', 'dark']) {
    // regression: quoridor-forced-pass-buried
    test(`storybook integration: mandatory Hill pass remains readable at ${width} ${theme}`, async ({
      page,
    }) => {
      await checkReadout(page, width, theme);
    });
  }
}

async function checkReadout(page: Page, width: number, theme: string) {
  await page.setViewportSize({
    width,
    height: width === 390 ? 844 : width === 768 ? 1024 : 900,
  });
  await page.goto(
    `/iframe.html?id=screens-games-quoridor-hill--must-pass&viewMode=story&globals=theme:${theme}`
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await page.evaluate(() => document.fonts.ready);
  const pass = page.getByRole('button', { name: /pass turn/i });
  await expect(pass).toBeEnabled();
  const geometry = await pass.evaluate((button) => {
    const bounds = button.getBoundingClientRect();
    const bar = button.closest('[data-testid$="-tools"]');
    if (bar === null) throw new Error('Pass action has no command bar');
    const outer = bar.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(button);
    const text = range.getBoundingClientRect();
    return {
      first: bar.querySelector('button') === button,
      contained:
        bounds.left >= outer.left &&
        bounds.right <= outer.right &&
        bounds.top >= outer.top &&
        bounds.bottom <= outer.bottom,
      readable:
        text.left >= bounds.left &&
        text.right <= bounds.right &&
        text.top >= bounds.top &&
        text.bottom <= bounds.bottom,
      withinWidth: bounds.left >= 0 && bounds.right <= window.innerWidth,
      withinHeight: bounds.top >= 0 && bounds.bottom <= window.innerHeight,
    };
  });
  expect(geometry).toEqual({
    first: true,
    contained: true,
    readable: true,
    withinWidth: true,
    withinHeight: true,
  });
  // Forced pass renders only the legal command; no move or wall tool is offered.
  await expect(page.locator('[data-testid$="-tools"] button')).toHaveCount(1);
  for (const id of ['mode-move', 'mode-h', 'mode-v'])
    await expect(page.getByTestId(`custom-game-board-${id}`)).toHaveCount(0);
  const squares = page
    .getByRole('group', { name: 'Quoridor board, nine columns and nine rows' })
    .getByRole('button');
  await expect(squares).toHaveCount(81);
  for (const square of await squares.all()) await expect(square).toBeDisabled();
  await expect(
    page.getByText('No pawn move or wall is legal. Pass your turn.', {
      exact: true,
    })
  ).toBeVisible();
}

// regression: storybook-hill-tools-observation
test('storybook integration: mandatory Hill pass has the sole legal command at 390 light', async ({
  page,
}) => {
  await checkReadout(page, 390, 'light');
});

test.afterEach(async ({ page }, testInfo) => {
  await page.screenshot({
    path: testInfo.outputPath('actual.png'),
    fullPage: true,
  });
});
