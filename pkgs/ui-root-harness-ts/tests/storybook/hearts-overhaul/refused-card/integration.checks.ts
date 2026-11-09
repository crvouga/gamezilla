// @io-wall-ok — literal browser regression; the canonical runner owns cleanup.
import { expect, test } from '@playwright/test';
import { captureHearts, openHearts } from '../evidence';
import { pressRefusedCard } from '../refused-input';

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  video: { mode: 'on', size: { width: 390, height: 844 } },
  trace: 'on',
});

// regression: hearts-refused-card-locator-waits-for-enabled
test('storybook integration: Hearts refused five of clubs accepts a trusted explanatory tap', async ({
  page,
}, info) => {
  await openHearts(
    page,
    'screens-games-hearts-interaction--pass-and-play',
    'light'
  );
  const cards = page
    .getByRole('toolbar', { name: 'Your hand' })
    .getByRole('button');
  for (const index of [0, 1, 2]) await cards.nth(index).tap();
  await page.getByTestId('custom-game-board-pass').tap();
  const board = page.getByTestId('custom-game-board');
  await expect(board).toHaveAttribute('data-position', /:play:/);
  const position = await board.getAttribute('data-position');
  await pressRefusedCard(
    page,
    page.getByTestId('custom-game-board-card-5C'),
    true
  );
  await expect(board).toHaveAttribute('data-position', position ?? '');
  await expect(page.getByTestId('custom-game-board-refusal')).toHaveText(
    'The first trick begins with the two of clubs.'
  );
  await captureHearts(page, info, 'refused-five-of-clubs');
});
