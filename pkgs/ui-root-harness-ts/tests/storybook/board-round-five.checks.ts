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

// regression: chess-puzzle-board-shifts-on-outcome
test('screens-puzzles-chess-play--wrong-move-recovery regression chess-puzzle-board-shifts-on-outcome', async ({
  page,
}) => {
  const story =
    index.entries['screens-puzzles-chess-play--wrong-move-recovery'];
  if (!story) throw new Error('Missing literal regression story');
  const scenario = visualScenarios(story).find(
    (item) => item.width === 390 && item.theme === 'light'
  );
  if (!scenario) throw new Error('Missing phone light scenario');
  await verifyStoryScenario(page, story.id, scenario);
});

// regression: chess-puzzle-phone-board-too-small
test('screens-puzzles-chess-play--keyboard-help regression chess-puzzle-phone-board-too-small', async ({
  page,
}) => {
  const story = index.entries['screens-puzzles-chess-play--keyboard-help'];
  if (!story) throw new Error('Missing literal regression story');
  const scenario = visualScenarios(story).find(
    (item) => item.width === 390 && item.theme === 'light'
  );
  if (!scenario) throw new Error('Missing phone light scenario');
  await verifyStoryScenario(page, story.id, scenario);
});

// regression: hearts-unavailable-cards-subtle
test('screens-games-hearts-board--your-turn-to-play regression hearts-unavailable-cards-subtle', async ({
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

// regression: quoridor-phone-toolbar-four-pixel-wrap
// regression: quoridor-spatial-task-too-small
test('screens-games-quoridor-hill--precise-coordinates regression quoridor-spatial-task-too-small', async ({
  page,
}) => {
  const story =
    index.entries['screens-games-quoridor-hill--precise-coordinates'];
  if (!story) throw new Error('Missing literal regression story');
  const scenario = visualScenarios(story).find(
    (item) => item.width === 390 && item.theme === 'light'
  );
  if (!scenario) throw new Error('Missing phone light scenario');
  await verifyStoryScenario(page, story.id, scenario);
});

// regression: shared-board-long-name-rail
test('screens-games-frame-geometry--long-name-rail regression shared-board-long-name-rail', async ({
  page,
}) => {
  const story = index.entries['screens-games-frame-geometry--long-name-rail'];
  if (!story) throw new Error('Missing literal regression story');
  const scenario = visualScenarios(story).find(
    (item) => item.width === 390 && item.theme === 'light'
  );
  if (!scenario) throw new Error('Missing phone light scenario');
  await verifyStoryScenario(page, story.id, scenario);
});

// regression: shared-board-chip-facts-wrap-extra-row
// regression: shared-board-metadata-height
test('screens-games-frame-geometry--four-players regression shared-board-metadata-height', async ({
  page,
}) => {
  const story = index.entries['screens-games-frame-geometry--four-players'];
  if (!story) throw new Error('Missing literal regression story');
  const scenario = visualScenarios(story).find(
    (item) => item.width === 390 && item.theme === 'light'
  );
  if (!scenario) throw new Error('Missing phone light scenario');
  await verifyStoryScenario(page, story.id, scenario);
});

// regression: sokoban-story-restart-primary
test('screens-games-sokoban-puzzle--in-progress regression sokoban-story-restart-primary', async ({
  page,
}) => {
  const story = index.entries['screens-games-sokoban-puzzle--in-progress'];
  if (!story) throw new Error('Missing literal regression story');
  const scenario = visualScenarios(story).find(
    (item) => item.width === 390 && item.theme === 'light'
  );
  if (!scenario) throw new Error('Missing phone light scenario');
  await verifyStoryScenario(page, story.id, scenario);
});

// regression: shared-board-desktop-rail-crowds-board
test('screens-games-frame-geometry--two-players regression shared-board-desktop-rail-crowds-board', async ({
  page,
}) => {
  const story = index.entries['screens-games-frame-geometry--two-players'];
  if (!story) throw new Error('Missing literal two-player regression');
  const scenario = visualScenarios(story).find(
    (item) => item.width === 1440 && item.theme === 'light'
  );
  if (!scenario) throw new Error('Missing desktop light scenario');
  await verifyStoryScenario(page, story.id, scenario);
});

// regression: sokoban-history-forgets-saved-completion
test('screens-games-sokoban-puzzle--corner-recovery regression sokoban-history-forgets-saved-completion', async ({
  page,
}) => {
  const story = index.entries['screens-games-sokoban-puzzle--corner-recovery'];
  if (!story) throw new Error('Missing literal saved completion regression');
  const scenario = visualScenarios(story).find(
    (item) => item.width === 390 && item.theme === 'light'
  );
  if (!scenario) throw new Error('Missing phone light scenario');
  await verifyStoryScenario(page, story.id, scenario);
});

// Related board components need the desktop matrix as well as their canonical phone cases.
for (const id of [
  'product-cardtable--states',
  'games-cellgridboard-boundary-contrast--open-water',
  'product-cellgridboard--states',
  'components-inputs-paddlecourt--states',
  'components-inputs-trailarena--states',
  'product-wordtileboard--states',
  'product-wordtileboard--enlarged-placement',
  'product-wordtileworkbench--secondary-tools',
]) {
  for (const theme of ['light', 'dark']) {
    test(`${id} ${theme}-1440`, async ({ page }) => {
      const story = index.entries[id];
      if (!story) throw new Error('Missing related board reference');
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
