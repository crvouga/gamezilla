import { expect, test } from '@playwright/test';
import { verifyStoryScenario } from '../verify-story-scenario';

const screens = [
  'space-person-menu--add-bot',
  'screens-game-home--with-puzzles-and-settings',
  'screens-game-sessions-setup--host-ready-to-start',
  'screens-game-sessions-setup--bot-table',
  'screens-game-sessions-setup-seat--bot-difficulty',
  'screens-game-sessions-stage--against-bot',
  'screens-game-sessions-result--bot-opponent',
  'screens-history-replay--bot-opponent',
  'screens-puzzles-stage--hint',
  'screens-puzzles-result--solved',
];

for (const id of screens) {
  for (const width of [390, 1280]) {
    test(`mascot-review ${id} ${width}`, async ({ page }, info) => {
      await verifyStoryScenario(page, id, {
        width,
        height: width === 390 ? 844 : 800,
        theme: width === 390 ? 'light' : 'dark',
        suffix: '',
        globals: { spaceRole: 'host' },
      });
      const portrait = page
        .locator('img[data-component="MascotPortrait"]')
        .first();
      await expect(portrait).toBeVisible();
      await portrait.evaluate((image: HTMLImageElement) => image.decode());
      await page.screenshot({ path: info.outputPath(`${id}--${width}.png`) });
      if (id === 'screens-game-sessions-stage--against-bot') {
        const bars = page.locator('[data-component="GamePlayerBar"]');
        for (const [index, bar] of (await bars.all()).entries()) {
          await bar.screenshot({
            path: info.outputPath(`seat-${index}--${width}.png`),
          });
        }
      }
      if (id === 'screens-puzzles-stage--hint') {
        await expect(portrait).toHaveAttribute('width', '32');
        await page
          .locator('[data-component="SpeakingAvatar"]')
          .screenshot({ path: info.outputPath(`coach--${width}.png`) });
      }
    });
  }
}
