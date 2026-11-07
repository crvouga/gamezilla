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

// regression: word-tiles-phone-action-overload
// regression: word-tiles-cramped-precision-window
for (const id of [
  'screens-games-word-tiles-board--your-turn',
  'screens-games-word-tiles-board--enlarged-coordinates',
  'screens-games-word-tiles-puzzle--enlarged-blank',
]) {
  const story = index.entries[id];
  if (!story) throw new Error('Missing literal Word Tiles regression story');
  for (const scenario of visualScenarios(story)) {
    test(`${id} regression word-tiles-cramped-precision-window ${scenario.theme}${scenario.suffix}`, async ({
      page,
    }) => {
      await verifyStoryScenario(page, story.id, scenario);
    });
  }
}

// regression: word-tiles-cramped-precision-window
test('screens-games-word-tiles-puzzle--enlarged-blank regression word-tiles-cramped-precision-window', async ({
  page,
}) => {
  const story =
    index.entries['screens-games-word-tiles-puzzle--enlarged-blank'];
  if (!story) throw new Error('Missing literal regression story');
  const scenario = visualScenarios(story).find(
    (item) => item.width === 390 && item.theme === 'light'
  );
  if (!scenario) throw new Error('Missing phone light scenario');
  await verifyStoryScenario(page, story.id, scenario);
});

// regression: word-tiles-rack-corner-hit-gap
test('screens-games-word-tiles-board--enlarged-coordinates regression word-tiles-rack-corner-hit-gap', async ({
  page,
}) => {
  const story =
    index.entries['screens-games-word-tiles-board--enlarged-coordinates'];
  if (!story) throw new Error('Missing literal rack regression story');
  const scenario = visualScenarios(story).find(
    (item) => item.width === 390 && item.theme === 'light'
  );
  if (!scenario) throw new Error('Missing phone light scenario');
  await verifyStoryScenario(page, story.id, scenario);
});

// regression: word-tiles-puzzle-desktop-board-overflow
test('screens-games-word-tiles-puzzle--enlarged-blank regression word-tiles-puzzle-desktop-board-overflow', async ({
  page,
}) => {
  const story =
    index.entries['screens-games-word-tiles-puzzle--enlarged-blank'];
  if (!story) throw new Error('Missing literal desktop puzzle regression');
  const scenario = visualScenarios(story).find(
    (item) => item.width === 1440 && item.theme === 'light'
  );
  if (!scenario) throw new Error('Missing desktop light scenario');
  await verifyStoryScenario(page, story.id, scenario);
});

// regression: word-tiles-match-desktop-board-overflow
test('screens-games-word-tiles-board--your-turn regression word-tiles-match-desktop-board-overflow', async ({
  page,
}) => {
  const story = index.entries['screens-games-word-tiles-board--your-turn'];
  if (!story) throw new Error('Missing literal desktop match regression');
  const scenario = visualScenarios(story).find(
    (item) => item.width === 1440 && item.theme === 'light'
  );
  if (!scenario) throw new Error('Missing desktop light scenario');
  await verifyStoryScenario(page, story.id, scenario);
});
