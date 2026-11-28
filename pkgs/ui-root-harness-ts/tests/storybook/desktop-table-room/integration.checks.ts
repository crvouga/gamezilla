import { expect, test } from '@playwright/test';
import { verifyStoryScenario } from '../verify-story-scenario';

// regression: quoridor-desktop-coordinate-board-shrinks
test('Quoridor desktop keeps the opening grid and wall targets in the first view', async ({
  page,
}, info) => {
  await verifyStoryScenario(page, 'screens-games-quoridor-classic--opening', {
    width: 1440,
    height: 900,
    globals: {},
    suffix: '',
  });
  const grid = page.getByTestId('game-session-board');
  const opening = await grid.boundingBox();
  expect(opening?.width).toBeGreaterThanOrEqual(440);
  await page.getByTestId('game-session-board-coordinates').click();
  await page.getByRole('button', { name: 'Horizontal wall' }).click();
  await grid.locator('[data-cell="d4"]').click();
  await expect(grid.locator('[data-cell="d4"]')).toHaveAttribute(
    'data-preview-edge-top',
    'true'
  );
  expect(await grid.boundingBox()).toEqual(opening);
  for (const control of [
    grid,
    page.getByTestId('game-session-board-precise-target'),
    page.getByTestId('game-session-board-wall-commit'),
    page.getByTestId('game-session-board-wall-cancel'),
    page.locator('[data-game-slot="controls"]'),
  ])
    await expect(control).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: info.outputPath('quoridor-wall.png') });
});

// regression: hearts-desktop-selection-scrolls-hand
test('Hearts desktop keeps all thirteen cards and the pass action in the first view after selection', async ({
  page,
}, info) => {
  await verifyStoryScenario(
    page,
    'screens-games-hearts-board--pass-three-cards',
    {
      width: 1440,
      height: 844,
      globals: {},
      suffix: '',
    }
  );
  const cards = page
    .getByRole('toolbar', { name: 'Your hand' })
    .getByRole('button');
  await expect(cards).toHaveCount(13);
  for (const card of await cards.all())
    await expect(card).toBeInViewport({ ratio: 1 });
  const pass = page.getByTestId('game-session-board-pass');
  await expect(pass).toBeEnabled();
  await expect(pass).toBeInViewport({ ratio: 1 });
  await expect(page.locator('[data-table-felt]')).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: info.outputPath('hearts-pass.png') });
});
