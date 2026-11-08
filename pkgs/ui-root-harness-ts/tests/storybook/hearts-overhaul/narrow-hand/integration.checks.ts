// @io-wall-ok — literal browser regression; the canonical runner owns cleanup.
import { expect, test } from '@playwright/test';
import { captureHearts, openHearts } from '../evidence';

test.use({
  viewport: { width: 320, height: 568 },
  hasTouch: true,
  video: { mode: 'on', size: { width: 320, height: 568 } },
  trace: 'on',
});

// regression: hearts-320-thirteen-card-targets
test('storybook integration: Hearts 320px thirteen-card hand keeps full touch targets', async ({
  page,
}, info) => {
  await openHearts(page, 'screens-games-hearts-board--passing', 'light');
  const cards = page
    .getByRole('toolbar', { name: 'Your hand' })
    .getByRole('button');
  await expect(cards).toHaveCount(13);
  for (const card of await cards.all()) {
    const bounds = await card.boundingBox();
    if (!bounds) throw new Error('Card has no bounds');
    expect(bounds.width).toBeGreaterThanOrEqual(44);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  }
  await cards.nth(0).tap();
  await cards.nth(1).tap();
  await cards.nth(2).tap();
  await expect(page.locator('[aria-pressed="true"]')).toHaveCount(3);
  await cards.nth(3).tap();
  await expect(
    page.getByText('3 of 3 chosen. Unselect a card to choose another.')
  ).toBeVisible();
  await cards.nth(2).tap();
  await cards.nth(3).tap();
  await captureHearts(page, info, 'narrow-touch-revised');
  await page.getByTestId('custom-game-board-pass').tap();
  await expect(page.getByTestId('custom-game-board-pass')).toHaveAttribute(
    'aria-busy',
    'true'
  );
});
