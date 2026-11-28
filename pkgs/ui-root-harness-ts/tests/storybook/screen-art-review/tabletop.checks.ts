import { expect, test } from '@playwright/test';
import { verifyStoryScenario } from '../verify-story-scenario';

const screens = [
  'components-feedback-spinner--states',
  'components-inputs-button--interactive',
  'components-data-display-menurow--states',
  'screens-spaces-home--empty',
  'screens-space-home--host-choosing',
  'screens-game-home--with-puzzles-and-settings',
  'screens-matchmaking-searching--searching',
  'screens-game-sessions-stage--against-bot',
  'screens-game-sessions-result--you-win',
  'screens-game-sessions-result--you-placed-second',
  'screens-games-chess-puzzle--solving',
  'screens-puzzles-result--solved',
  'screens-puzzles-result--failed',
  'screens-puzzles-stats--populated',
  'screens-matchmaking-ratings--game-rating',
  'screens-profile-tab--ready',
  'screens-friends-list--populated',
];

for (const width of [390, 768, 1280]) {
  const height = width === 390 ? 844 : 800;

  for (const story of screens) {
    test(`tabletop-review ${story} ${width} dark`, async ({ page }, info) => {
      try {
        await verifyStoryScenario(page, story, {
          width,
          height,
          globals: {},
          suffix: '',
        });
        const canvas = page.locator('#storybook-root');
        if (story === 'components-inputs-button--interactive') {
          await expect(canvas.getByRole('button', { name: 'Save' })).toHaveCSS(
            'background-image',
            /linear-gradient/
          );
        }
        if (story === 'components-data-display-menurow--states') {
          await expect(canvas.locator('.panel').first()).toHaveCSS(
            'background-image',
            /linear-gradient/
          );
          await expect(
            canvas.locator('[data-component="MenuRow"]').first()
          ).toHaveCSS('background-image', 'none');
        }
        if (story === 'components-feedback-spinner--states') {
          const ring = canvas.locator('[data-component="Spinner"]').first();
          await expect(ring).toHaveClass(/\btext-tint\b/);
          const busy = canvas.locator('button[aria-busy="true"]').first();
          await expect(busy.locator('[data-component="Spinner"]')).toHaveCSS(
            'color',
            await busy.evaluate((el) => getComputedStyle(el).color)
          );
        }
        await canvas.evaluate((root) =>
          Promise.all(
            Array.from(root.querySelectorAll('img'), (image) => image.decode())
          )
        );
        expect(
          await canvas.evaluate((root) => root.scrollWidth)
        ).toBeLessThanOrEqual(width);
      } finally {
        await page.screenshot({
          path: info.outputPath(`${story}--${width}-dark.png`),
          animations: 'disabled',
        });
      }
    });
  }
}
