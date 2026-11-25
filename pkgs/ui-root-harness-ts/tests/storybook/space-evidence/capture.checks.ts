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
const light = new Set([...scope.light, ...scope.interaction, ...boards.keys()]);

for (const [width, height] of [
  [390, 844],
  [1280, 800],
] as const) {
  test.describe(`${width}x${height}`, () => {
    test.use({ deviceScaleFactor: width === 390 ? 2 : 1 });
    for (const theme of ['light', 'dark'] as const) {
      for (const id of theme === 'dark' ? scope.dark : light) {
        test(`space-evidence ${id} ${theme}`, async ({ page }, info) => {
          const interaction =
            theme === 'light' && scope.interaction.includes(id);
          const play = index.entries[id]?.tags.includes('play-fn') === true;
          await page.emulateMedia({ colorScheme: theme });
          await verifyStoryScenario(page, id, {
            width,
            height,
            theme,
            globals: {},
            suffix: '',
          });
          const stem = `${id}--${width}x${height}-${theme}`;
          if (scope[theme].includes(id)) {
            await page.screenshot({ path: info.outputPath(`${stem}.png`) });
          }
          const group = theme === 'light' ? boards.get(id) : undefined;
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
              theme,
              interaction,
              play,
              group,
              box,
              sha: process.env['GITHUB_SHA'],
            })
          );
        });
      }
    }
  });
}
