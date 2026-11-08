// @io-wall-ok — deterministic response fixture driven by trusted browser inputs.
import { expect, test } from '@playwright/test';
import { auditHearts, captureHearts, openHearts } from '../evidence';

test.use({
  video: { mode: 'on', size: { width: 1440, height: 1024 } },
  trace: 'on',
});

for (const width of [390, 1440]) {
  for (const theme of ['light', 'dark']) {
    test.describe(`Hearts retry ${width} ${theme}`, () => {
      test.use({ viewport: { width, height: 844 }, hasTouch: width === 390 });
      test('storybook integration: Hearts refused pass preserves choices and retries', async ({
        page,
      }, info) => {
        await openHearts(
          page,
          'screens-games-hearts-interaction--retry-pass',
          theme
        );
        const cards = page
          .getByRole('toolbar', { name: 'Your hand' })
          .getByRole('button');
        const pass = page.getByTestId('custom-game-board-pass');
        if (width === 390) {
          for (const index of [0, 1, 2]) await cards.nth(index).tap();
          await pass.tap();
        } else {
          for (let index = 0; index < 20; index++) {
            await page.keyboard.press('Tab');
            if (
              await cards
                .first()
                .evaluate((card) => card === document.activeElement)
            )
              break;
          }
          await expect(cards.first()).toBeFocused();
          for (const key of [
            'Space',
            'ArrowRight',
            'Space',
            'ArrowRight',
            'Space',
            'Tab',
          ])
            await page.keyboard.press(key);
          await expect(pass).toBeFocused();
          await page.keyboard.press('Enter');
        }
        const error = page.getByTestId('custom-game-error');
        await expect(error).toContainText(
          'The choice could not be confirmed. Try again.'
        );
        await expect(page.locator('[aria-pressed="true"]')).toHaveCount(3);
        await expect(pass).toBeEnabled();
        await captureHearts(page, info, 'failed-pass-preserves-selection');
        if (width === 390) await pass.tap();
        else {
          await expect(pass).toBeFocused();
          await page.keyboard.press('Enter');
        }
        await expect(error).toHaveCount(0);
        await expect(pass).toHaveCount(0);
        await expect(
          page.locator('[aria-pressed="true"][aria-disabled="true"]')
        ).toHaveCount(3);
        await expect(
          page.getByTestId('custom-game-board-center')
        ).toContainText('Waiting for every player to pass');
        await captureHearts(page, info, 'retry-acknowledged');
        await auditHearts(page, info);
      });
    });
  }
}
