// @io-wall-ok — hosted evidence for every registered screen story family.
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { supportsStoryViewport } from '../../../storybook/scenarios';
import { verifyStoryScenario } from '../verify-story-scenario';

type Entry = { id: string; type: string; tags: string[] };
const index = JSON.parse(
  readFileSync(
    new URL('../../../.cache/storybook/index.json', import.meta.url),
    'utf8'
  )
) as { entries: Record<string, Entry> };
const gameReview = process.env['STORYBOOK_PATTERN'] === 'game-art-review';
const gameScreens = new Set([
  'space-choosing--screen',
  'space-setting-up--screen',
  'games-shared-game-tile--motifs',
  'screens-space-home--host-choosing',
  'screens-space-home--guest-waiting',
  'screens-game-home--with-puzzles-and-settings',
  'screens-game-home--shared-choices',
  'screens-games-chess-puzzle--solving',
]);
const navigationScreens = new Set([
  'screens-shell-tab-bar--spaces-current',
  'screens-shell-header-island--search-current',
  'screens-shell-header-island--sidebar-spaces-current',
  'screens-profile-tab--ready',
  'screens-profile-tab--no-friends',
  'screens-spaces-home--empty',
  'screens-space-join--missing',
  'screens-space-join--unavailable',
  'screens-space-ended--ended',
  'screens-shell-not-found--not-found',
  'screens-game-home--shared-choices',
]);
const listScreens = new Set([
  'screens-settings-index--with-billing',
  'screens-settings-index--preferences-changed',
  'screens-shell-account-menu--open',
  'screens-account--signed-in',
  'screens-game-sessions-setup-seat--bot-seat',
  'screens-game-sessions-stage-menu--player',
  'screens-matchmaking-home--find-timed',
  'screens-admin-synthetic-population--operator',
  'screens-admin-synthetic-user--running',
  'space-person-menu--add-bot',
]);
const emptyScreens = new Set([
  'screens-admin-live-watch--user-went-offline',
  'screens-spaces-home--empty',
  'screens-space-join--missing',
  'screens-space-ended--ended',
  'screens-search-people--idle',
  'screens-search-people--no-results',
  'screens-notifications-inbox--denied',
  'screens-notifications-inbox--empty',
  'screens-notifications-inbox--empty-archived',
  'screens-friends-list--empty',
  'screens-friends-user--unavailable',
  'screens-account-devices--empty',
  'screens-account-device-detail--not-found',
  'screens-history-games--empty',
  'screens-matchmaking-status--unavailable',
  'screens-spaces-members--empty',
  'screens-spaces-share--empty',
  'screens-puzzles-stage-status--empty',
  'screens-puzzles-link--unavailable',
  'screens-puzzles-home-themes--no-match',
  'screens-puzzles-review--unavailable',
  'screens-puzzles-stats--empty',
  'screens-puzzles-stats-log--empty',
  'screens-puzzles-stats-trend--empty',
  'screens-puzzle-packs-home--empty',
  'screens-puzzle-packs-home-browse--empty',
  'screens-puzzle-packs-home-continue--empty',
  'screens-puzzle-packs-home-mine--empty',
  'screens-puzzle-packs-home-playtests--empty',
  'screens-puzzle-packs-home-solved--empty',
]);
const selections = new Map([
  ['game-art-review', gameScreens],
  ['navigation-art-review', navigationScreens],
  ['list-icon-review', listScreens],
  ['empty-art-review', emptyScreens],
]);
const review = process.env['STORYBOOK_PATTERN'] ?? 'screen-art-review';
const selection = selections.get(review);
const seen = new Set<string>();
const extra = new Set([
  'components-illustration--catalog',
  'components-inputs-iconbutton--states',
  'screens-search-people--no-results',
  'screens-history-games--empty',
  'screens-matchmaking-status--unavailable',
  'screens-puzzle-packs-home--empty',
  'screens-puzzle-packs-home-browse--empty',
  'screens-puzzle-packs-home-continue--empty',
  'screens-puzzle-packs-home-mine--empty',
  'screens-puzzle-packs-home-playtests--empty',
  'screens-puzzle-packs-home-solved--empty',
  'screens-puzzles-link--unavailable',
  'screens-spaces-home--empty',
  'screens-spaces-members--empty',
  'screens-spaces-share--empty',
  'screens-game-sessions-home--no-game-many-players',
  'screens-game-home--with-puzzles-and-settings',
  'screens-game-home--shared-choices',
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
    selection
      ? !selection.has(entry.id)
      : !extra.has(entry.id) &&
        (!family.startsWith('screens-') || seen.has(family))
  )
    continue;
  seen.add(family);
  for (const width of gameReview ? [390, 768, 1280] : [390, 1280]) {
    if (!supportsStoryViewport(entry, width)) continue;
    test(`${review} ${entry.id} ${width}`, async ({ page }, info) => {
      const height = width === 390 ? 844 : 800;

      try {
        await verifyStoryScenario(page, entry.id, {
          width,
          height,
          suffix: '',
          globals: selection ? { spaceRole: 'host' } : {},
        });
        const art = page.locator(
          '[data-component="StateBlockIcon"] > img[data-icon-family="artwork"]'
        );
        if (
          review === 'empty-art-review' &&
          [
            'screens-spaces-home--empty',
            'screens-search-people--idle',
            'screens-notifications-inbox--denied',
          ].includes(entry.id)
        ) {
          await expect(art).toHaveCount(1);
          await expect(art).toHaveCSS('width', '96px');
          await expect(art.locator('..')).toHaveCSS('border-top-width', '0px');
          await art.evaluate((image: HTMLImageElement) => image.decode());
        }
        const pictures = page.locator('img[data-component="Illustration"]');
        for (const picture of await pictures.all()) {
          await picture.evaluate((image: HTMLImageElement) => image.decode());
          await expect(picture).toHaveAttribute('alt', '');
        }
      } finally {
        await page.screenshot({
          path: info.outputPath(`${entry.id}--${width}.png`),
          animations: 'disabled',
        });
      }
    });
  }
}
