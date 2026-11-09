// @io-wall-ok — trusted browser input; the canonical runner owns cleanup.
import { expect, type Locator, test } from '@playwright/test';
import { auditHearts, captureHearts, openHearts } from '../evidence';
import { saveHeartsMetrics, startHeartsMetrics } from '../metrics';
import { pressRefusedCard } from '../refused-input';

test.use({
  video: { mode: 'on', size: { width: 1440, height: 1024 } },
  trace: 'on',
});

async function activate(card: Locator, touch: boolean) {
  if (touch) await card.tap();
  else await card.click();
}

for (const width of [320, 390, 768, 1440]) {
  for (const theme of ['light', 'dark']) {
    const touch = width < 1024;
    const viewport = { width, height: width === 768 ? 1024 : 844 };
    test.describe(`Hearts accepted exchange ${width} ${theme}`, () => {
      test.use({
        viewport,
        hasTouch: touch,
      });
      test('storybook integration: Hearts trusted pass acceptance and complete trick', async ({
        page,
      }, info) => {
        const cdp = await page.context().newCDPSession(page);
        const rate = width < 768 ? 4 : 1;
        await cdp.send('Emulation.setCPUThrottlingRate', { rate });
        await openHearts(
          page,
          'screens-games-hearts-interaction--pass-and-play',
          theme
        );
        await startHeartsMetrics(page);
        const board = page.getByTestId('custom-game-board');
        const hand = page.getByRole('toolbar', { name: 'Your hand' });
        const cards = hand.getByRole('button');
        await expect(cards).toHaveCount(13);
        await captureHearts(page, info, 'before-pass');
        for (const index of [0, 1, 2]) await activate(cards.nth(index), touch);
        await activate(page.getByTestId('custom-game-board-pass'), touch);
        await expect(board).toHaveAttribute('data-position', /:play:/);
        await expect(page.getByTestId('custom-game-board-pass')).toHaveCount(0);
        await expect(cards).toHaveCount(13);
        await captureHearts(page, info, 'pass-accepted');
        const before = await board.getAttribute('data-position');
        await pressRefusedCard(
          page,
          hand.locator('[data-refused="true"]').first(),
          touch
        );
        await expect(board).toHaveAttribute('data-position', before ?? '');
        await expect(
          page.getByTestId('custom-game-board-refusal')
        ).not.toBeEmpty();
        await captureHearts(page, info, 'illegal-play-explained');
        for (const count of [1, 2, 3, 4]) {
          const legal = hand.locator('button[aria-disabled="false"]').first();
          const cardId = await legal.getAttribute('data-testid');
          await activate(legal, touch);
          await expect(page.getByTestId(cardId ?? '')).toHaveCount(0);
          await captureHearts(page, info, `trick-card-${count}`);
        }
        await expect(
          page.getByTestId('custom-game-board-center')
        ).toContainText('took the trick');
        await saveHeartsMetrics(page, info, rate);
        await auditHearts(page, info);
      });
    });
  }
}
