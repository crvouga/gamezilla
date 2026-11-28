import { expect, type Page, test } from '@playwright/test';

// regression: compact-word-tile-values-unavailable
for (const width of [390, 768, 1440]) {
  test(`storybook integration: word tile value readout is legible at ${width}/dark`, async ({
    page,
  }) => {
    await checkReadout(page, width);
  });
}

async function checkReadout(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(
    `/iframe.html?id=screens-games-word-tiles-board--your-turn&viewMode=story`
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  const board = page.locator('[data-component="WordTileBoard"]');
  const details = page.getByTestId(
    `${await board.getAttribute('data-testid')}-square-details`
  );
  const occupied = board.getByRole('button', {
    name: 'C 3, g8, committed',
    exact: true,
  });
  const label = await occupied.getAttribute('aria-label');
  if (label === null) throw new Error('Fixture has no committed C tile');
  const tile = await occupied.boundingBox();
  if (tile === null) throw new Error('Committed tile is missing');
  await page.mouse.click(tile.x + tile.width / 2, tile.y + tile.height / 2);
  // A short visible line; the square's whole name stays for listeners.
  await expect(details.locator('[aria-hidden="true"]')).toHaveText('g8 · C 3');
  await expect(details).toContainText(label);
  expect(
    await details.evaluate((node) =>
      Number.parseFloat(getComputedStyle(node).fontSize)
    )
  ).toBeGreaterThanOrEqual(12);
  const box = await details.boundingBox();
  if (box === null) throw new Error('Square detail readout is missing');
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
  await expect(occupied).toHaveAttribute('aria-label', label);
}

// regression: storybook-word-readout-observation
test('storybook integration: committed C 3 g8 has a readable adjacent value at 390', async ({
  page,
}) => {
  await checkReadout(page, 390);
});

test.afterEach(async ({ page }, testInfo) => {
  await page.screenshot({
    path: testInfo.outputPath('actual.png'),
    fullPage: true,
  });
});
