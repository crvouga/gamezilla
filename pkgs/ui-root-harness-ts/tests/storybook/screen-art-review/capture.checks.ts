// @io-wall-ok — hosted evidence for every registered screen story family.
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { supportsStoryViewport } from '../../../storybook/scenarios';
import { verifyStoryScenario } from '../verify-story-scenario';

type Entry = { id: string; type: string; tags: string[] };
const index: { entries: Record<string, Entry> } = JSON.parse(
  readFileSync(
    new URL('../../../.cache/storybook/index.json', import.meta.url),
    'utf8'
  )
);
const seen = new Set<string>();
const extra = new Set([
  'components-illustration--catalog',
  'screens-custom-games-home--no-game-many-players',
  'screens-game-home--with-puzzles-and-settings',
  'screens-game-home--open-more',
  'screens-friends-list--empty',
  'screens-account-devices--empty',
  'screens-notifications-inbox--empty-archived',
  'screens-notifications-inbox--empty',
  'screens-puzzles-stats--empty',
  'screens-puzzles-stats-log--empty',
  'screens-puzzles-stats-trend--empty',
]);
for (const entry of Object.values(index.entries)) {
  if (entry.type !== 'story') continue;
  const family = entry.id.split('--')[0] ?? entry.id;
  if (
    !extra.has(entry.id) &&
    (!family.startsWith('screens-') || seen.has(family))
  )
    continue;
  seen.add(family);
  for (const width of [390, 1280]) {
    if (!supportsStoryViewport(entry, width)) continue;
    test(`screen-art-review ${entry.id} ${width}`, async ({ page }, info) => {
      const height = width === 390 ? 844 : 800;
      const theme = width === 390 ? 'light' : 'dark';
      await verifyStoryScenario(page, entry.id, {
        width,
        height,
        theme,
        suffix: '',
        globals: {},
      });
      const pictures = page.locator('img[data-component="Illustration"]');
      for (const picture of await pictures.all()) {
        await picture.evaluate((image: HTMLImageElement) => image.decode());
        await expect(picture).toHaveAttribute('alt', '');
      }
      await page.screenshot({
        path: info.outputPath(`${entry.id}--${width}.png`),
        animations: 'disabled',
      });
    });
  }
}
