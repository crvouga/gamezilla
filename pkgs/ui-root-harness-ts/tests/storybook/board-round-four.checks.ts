// @io-wall-ok — canonical static Storybook regression adapter.
import { readFileSync } from 'node:fs';
import { test } from '@playwright/test';
import { visualScenarios } from '../../storybook/scenarios';
import { verifyStoryScenario } from './verify-story-scenario';

const index = JSON.parse(
  readFileSync(
    new URL('../../.cache/storybook/index.json', import.meta.url),
    'utf8'
  )
) as {
  entries: Record<string, { id: string; type: string; importPath: string }>;
};

// regression: battleship-placement-detached-overview
test('screens-games-battleship-setup--enlarged-placement regression battleship-placement-detached-overview', async ({
  page,
}) => {
  const story =
    index.entries['screens-games-battleship-setup--enlarged-placement'];
  if (!story) throw new Error('Missing literal regression story');
  const scenario = visualScenarios(story).find(
    (item) => item.width === 390 && item.theme === 'light'
  );
  if (!scenario) throw new Error('Missing phone light scenario');
  await verifyStoryScenario(page, story.id, scenario);
});

// regression: hearts-legal-card-selection-emphasis
test('screens-games-hearts-board--your-turn-to-play regression hearts-legal-card-selection-emphasis', async ({
  page,
}) => {
  const story = index.entries['screens-games-hearts-board--your-turn-to-play'];
  if (!story) throw new Error('Missing literal regression story');
  const scenario = visualScenarios(story).find(
    (item) => item.width === 390 && item.theme === 'light'
  );
  if (!scenario) throw new Error('Missing phone light scenario');
  await verifyStoryScenario(page, story.id, scenario);
});

// regression: hearts-seat-fact-wrap-separator
test('screens-games-hearts-board--passing regression hearts-seat-fact-wrap-separator', async ({
  page,
}) => {
  const story = index.entries['screens-games-hearts-board--passing'];
  if (!story) throw new Error('Missing literal regression story');
  const scenario = visualScenarios(story).find(
    (item) => item.width === 390 && item.theme === 'light'
  );
  if (!scenario) throw new Error('Missing phone light scenario');
  await verifyStoryScenario(page, story.id, scenario);
});

// regression: word-tiles-cat-status-clipping
test('screens-games-word-tiles-board--recover-and-submit regression word-tiles-cat-status-clipping', async ({
  page,
}) => {
  const story =
    index.entries['screens-games-word-tiles-board--recover-and-submit'];
  if (!story) throw new Error('Missing literal regression story');
  const scenario = visualScenarios(story).find(
    (item) => item.width === 390 && item.theme === 'light'
  );
  if (!scenario) throw new Error('Missing phone light scenario');
  await verifyStoryScenario(page, story.id, scenario);
});

// regression: word-tiles-enlarged-focus-outside-viewport
// regression: word-tiles-enlarged-context-loss
test('screens-games-word-tiles-board--enlarged-coordinates regression word-tiles-enlarged-context-loss', async ({
  page,
}) => {
  const story =
    index.entries['screens-games-word-tiles-board--enlarged-coordinates'];
  if (!story) throw new Error('Missing literal regression story');
  const scenario = visualScenarios(story).find(
    (item) => item.width === 390 && item.theme === 'light'
  );
  if (!scenario) throw new Error('Missing phone light scenario');
  await verifyStoryScenario(page, story.id, scenario);
});

// regression: word-tiles-exchange-history-occlusion
test('screens-games-word-tiles-board--accepted-exchange regression word-tiles-exchange-history-occlusion', async ({
  page,
}) => {
  const story =
    index.entries['screens-games-word-tiles-board--accepted-exchange'];
  if (!story) throw new Error('Missing literal regression story');
  const scenario = visualScenarios(story).find(
    (item) => item.width === 390 && item.theme === 'light'
  );
  if (!scenario) throw new Error('Missing phone light scenario');
  await verifyStoryScenario(page, story.id, scenario);
});

// New board-local compositions retain desktop evidence as well as the canonical phone cases.
for (const id of [
  'games-battleship-placement-layout--enlarged',
  'product-wordtileworkbench--recovery',
]) {
  for (const theme of ['light', 'dark']) {
    test(`${id} ${theme}-1440`, async ({ page }) => {
      const story = index.entries[id];
      if (!story) throw new Error('Missing board-local reference');
      const phone = visualScenarios(story).find((item) => item.theme === theme);
      if (!phone) throw new Error('Missing theme scenario');
      await verifyStoryScenario(page, id, {
        ...phone,
        width: 1440,
        suffix: '-1440',
        baseline: phone.baseline.replace('.png', '-1440.png'),
      });
    });
  }
}

// regression: quoridor-hill-precise-controls-below-viewport
test('screens-games-quoridor-hill--precise-coordinates regression quoridor-hill-precise-controls-below-viewport', async ({
  page,
}) => {
  const story =
    index.entries['screens-games-quoridor-hill--precise-coordinates'];
  if (!story) throw new Error('Missing four-player Hill regression');
  const scenario = visualScenarios(story).find(
    (item) => item.width === 390 && item.theme === 'light'
  );
  if (!scenario) throw new Error('Missing phone light scenario');
  await verifyStoryScenario(page, story.id, scenario);
});

// regression: quoridor-desktop-wall-confirmation-below-viewport
test('screens-games-quoridor-classic--precise-coordinates regression quoridor-desktop-wall-confirmation-below-viewport', async ({
  page,
}) => {
  const story =
    index.entries['screens-games-quoridor-classic--precise-coordinates'];
  if (!story) throw new Error('Missing Classic e2 then d4h regression');
  const scenario = visualScenarios(story).find(
    (item) => item.width === 1440 && item.theme === 'light'
  );
  if (!scenario) throw new Error('Missing desktop light scenario');
  await verifyStoryScenario(page, story.id, scenario);
});
