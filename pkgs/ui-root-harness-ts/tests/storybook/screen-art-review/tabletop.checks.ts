import { expect, test } from '@playwright/test';
import { verifyStoryScenario } from '../verify-story-scenario';

const screens = [
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
  for (const theme of ['light', 'dark']) {
    for (const story of screens) {
      test(`tabletop-review ${story} ${width} ${theme}`, async ({
        page,
      }, info) => {
        try {
          await verifyStoryScenario(page, story, {
            width,
            height,
            theme,
            globals: {},
            suffix: '',
          });
          const canvas = page.locator('#storybook-root');
          expect(
            await canvas.evaluate((root) => root.scrollWidth)
          ).toBeLessThanOrEqual(width);
        } finally {
          await page.screenshot({
            path: info.outputPath(`${story}--${width}-${theme}.png`),
            animations: 'disabled',
          });
        }
      });
    }
  }
}
