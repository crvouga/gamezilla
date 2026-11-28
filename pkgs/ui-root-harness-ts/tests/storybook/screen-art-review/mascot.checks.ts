// @io-wall-ok — compare the hosted images with the shared portrait source.
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { verifyStoryScenario } from '../verify-story-scenario';

const portraitFile = new URL(
  '../../../../ui-root-client-ts/assets/mascot/portrait.svg',
  import.meta.url
);
const silhouette = /<path[^>]+ d="([^"]+)"/.exec(
  readFileSync(portraitFile, 'utf8')
)?.[1];
if (!silhouette) throw new Error('Missing mascot silhouette');

const screens = [
  'space-person-menu--add-bot',
  'screens-game-home--shared-choices',
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
      try {
        await verifyStoryScenario(page, id, {
          width,
          height: width === 390 ? 844 : 800,
          suffix: '',
          globals: { spaceRole: 'host' },
        });
      } finally {
        await page.screenshot({ path: info.outputPath(`${id}--${width}.png`) });
      }
      const images = page.locator('#storybook-root img:visible');
      const index = await images.evaluateAll(async (nodes, outline) => {
        for (const [i, node] of nodes.entries()) {
          const image = node as HTMLImageElement;
          await image.decode();
          const source = await (await fetch(image.currentSrc)).text();
          if (source.includes(outline)) return i;
        }
        return -1;
      }, silhouette);
      expect(index).toBeGreaterThanOrEqual(0);
      const portrait = images.nth(index);
      if (id === 'screens-game-sessions-stage--against-bot') {
        const bars = page.getByTestId(/^game-session-(white|black)$/);
        for (const [index, bar] of (await bars.all()).entries()) {
          await bar.screenshot({
            path: info.outputPath(`seat-${index}--${width}.png`),
          });
        }
      }
      if (id === 'screens-puzzles-stage--hint') {
        await expect(portrait).toHaveAttribute('width', '32');
        await page
          .getByText('Coach', { exact: true })
          .locator('../..')
          .screenshot({ path: info.outputPath(`coach--${width}.png`) });
      }
    });
  }
}
