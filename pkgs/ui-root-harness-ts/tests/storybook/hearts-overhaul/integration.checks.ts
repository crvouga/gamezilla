// @io-wall-ok — canonical Storybook browser evidence; Playwright owns cleanup.
import { expect, test } from '@playwright/test';
import { auditHearts, captureHearts, openHearts } from './evidence';
import { saveHeartsMetrics, startHeartsMetrics } from './metrics';

const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];
for (const viewport of viewports) {
  for (const theme of ['light', 'dark']) {
    test.describe(`Hearts ${viewport.width} ${theme}`, () => {
      test.use({
        viewport,
        video: { mode: 'on', size: viewport },
        trace: 'on',
      });
      test('storybook integration: Hearts select revise and pass', async ({
        page,
      }, info) => {
        const failures: string[] = [];
        page.on('pageerror', (error) => failures.push(error.message));
        const cpuRate = viewport.width < 768 ? 4 : 1;
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
        await openHearts(page, 'screens-games-hearts-board--passing', theme);
        await captureHearts(page, info, 'before-selection');
        await startHeartsMetrics(page);
        const cards = page
          .getByRole('toolbar', { name: 'Your hand' })
          .getByRole('button');
        await expect(cards).toHaveCount(13);
        await cards.first().focus();
        await page.keyboard.press('Space');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Space');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Space');
        await expect(page.locator('[aria-pressed="true"]')).toHaveCount(3);
        await captureHearts(page, info, 'three-selected');
        await page.keyboard.press('Space');
        await page.keyboard.press('End');
        await page.keyboard.press('Space');
        await expect(page.locator('[aria-pressed="true"]')).toHaveCount(3);
        await page.keyboard.press('Tab');
        const pass = page.getByTestId('custom-game-board-pass');
        await expect(pass).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(pass).toHaveAttribute('aria-busy', 'true');
        await captureHearts(page, info, 'pass-sending');
        await saveHeartsMetrics(page, info, cpuRate);
        await auditHearts(page, info);
        expect(failures).toEqual([]);
      });
    });
  }
}

for (const theme of ['light', 'dark']) {
  test.describe(`Hearts states ${theme}`, () => {
    test.use({ video: 'on', trace: 'on' });
    for (const story of [
      'your-turn-to-play',
      'waiting-for-turn',
      'watching',
      'game-over',
      'cards-on-their-way',
      'pass-through-first-trick',
    ]) {
      test(`storybook integration: Hearts ${story}`, async ({ page }, info) => {
        await openHearts(page, `screens-games-hearts-board--${story}`, theme);
        await captureHearts(page, info, story);
        await auditHearts(page, info);
      });
    }
  });
}
