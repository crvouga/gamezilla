// @io-wall-ok — trusted browser input; the canonical runner owns cleanup.
import { expect, test } from '@playwright/test';
import { auditHearts, captureHearts, openHearts } from '../evidence';
import { saveHeartsMetrics, startHeartsMetrics } from '../metrics';

test.use({
  viewport: { width: 320, height: 568 },
  hasTouch: true,
  video: { mode: 'on', size: { width: 320, height: 568 } },
  trace: 'on',
});

test('storybook integration: Hearts short passing view keeps scores and selected cards available', async ({
  page,
}, info) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await openHearts(
    page,
    'screens-games-hearts-interaction--pass-and-play',
    'light'
  );
  await startHeartsMetrics(page);
  const cards = page
    .getByRole('toolbar', { name: 'Your hand' })
    .getByRole('button');
  await cards.first().tap();
  const toggle = page.getByRole('button', { name: 'Players and scores' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('custom-game-board-seat-red')).toContainText(
    'morgan'
  );
  await expect(page.getByTestId('custom-game-board-seat-red')).toContainText(
    'Score 0'
  );
  await captureHearts(page, info, 'short-phone-scores-open');
  await page.keyboard.press('Space');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('[aria-pressed="true"]')).toHaveCount(1);
  await cards.nth(1).tap();
  await cards.nth(2).tap();
  await captureHearts(page, info, 'short-phone-pass-ready');
  await page.getByTestId('custom-game-board-pass').tap();
  await expect(page.getByTestId('custom-game-board')).toHaveAttribute(
    'data-position',
    /:play:/
  );
  await expect(toggle).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Hearts table' })).toBeVisible();
  await captureHearts(page, info, 'short-phone-trick-table-restored');
  await saveHeartsMetrics(page, info, 4);
  await auditHearts(page, info);
});
