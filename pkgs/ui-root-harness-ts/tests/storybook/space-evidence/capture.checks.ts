// @io-wall-ok — hosted browser evidence and the built Storybook index.
import { readFileSync, writeFileSync } from 'node:fs';
import { test } from '@playwright/test';
import { verifyStoryScenario } from '../verify-story-scenario';
import scope from './scope.json' with { type: 'json' };

const index = JSON.parse(
  readFileSync(
    new URL('../../../.cache/storybook/index.json', import.meta.url),
    'utf8'
  )
) as { entries: Record<string, { tags: string[] }> };
const boards = new Map(
  Object.entries(scope.boards).flatMap(([group, ids]) =>
    ids.map((id) => [id, group] as const)
  )
);
const screens = new Set([
  ...scope.screens,
  ...scope.interaction,
  ...boards.keys(),
]);

// regression: quoridor-hill-camera-viewport
for (const [width, height] of [
  [390, 844],
  [1280, 800],
] as const) {
  test.describe(`${width}x${height}`, () => {
    test.use({ deviceScaleFactor: width === 390 ? 2 : 1 });

    for (const id of screens) {
      test(`space-evidence ${id} dark`, async ({ page }, info) => {
        const interaction = scope.interaction.includes(id);
        const play = index.entries[id]?.tags.includes('play-fn') === true;
        await verifyStoryScenario(page, id, {
          width,
          height,
          globals: {},
          suffix: '',
        });
        const stem = `${id}--${width}x${height}-dark`;
        if (scope.screens.includes(id)) {
          await page.screenshot({ path: info.outputPath(`${stem}.png`) });
        }
        const group = boards.get(id);
        const box = group
          ? await page
              .locator(
                '[data-game-board], [data-testid="chess-puzzle-board-frame"], [data-component="WordTileBoard"]'
              )
              .first()
              .boundingBox()
          : undefined;
        writeFileSync(
          info.outputPath(`${stem}.json`),
          JSON.stringify({
            id,
            width,
            height,
            interaction,
            play,
            group,
            box,
            sha: process.env['GITHUB_SHA'],
          })
        );
      });
    }
  });
}
