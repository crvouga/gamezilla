// @io-wall-ok — native static Storybook regression adapter.
import { readFileSync } from 'node:fs';
import { type Page, test } from '@playwright/test';
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
async function verify(page: Page, id: string, width: number) {
  const story = index.entries[id];
  if (!story) throw new Error(`Missing story: ${id}`);
  const scenario = visualScenarios(story).find(
    (item) => item.width === width && item.theme === 'light'
  );
  if (!scenario) throw new Error(`Missing viewport: ${width}`);
  await verifyStoryScenario(page, id, scenario);
}

// regression: quoridor-goal-marker-reset-border
test('screens-games-quoridor-classic--opening regression quoridor-goal-marker-reset-border', async ({
  page,
}) => {
  await verify(page, 'screens-games-quoridor-classic--opening', 390);
});

// regression: word-tiles-fitted-cell-rounded-hit-gap
test('screens-games-word-tiles-puzzle--reach-target regression word-tiles-fitted-cell-rounded-hit-gap', async ({
  page,
}) => {
  await verify(page, 'screens-games-word-tiles-puzzle--reach-target', 1440);
});

// regression: word-tiles-desktop-seat-host-clipping
test('screens-games-word-tiles-board--assign-a-blank regression word-tiles-desktop-seat-host-clipping', async ({
  page,
}) => {
  await verify(page, 'screens-games-word-tiles-board--assign-a-blank', 1440);
});

// regression: shared-frame-draw-board-below-bound
test('screens-games-frame-geometry--drawn regression shared-frame-draw-board-below-bound', async ({
  page,
}) => {
  await verify(page, 'screens-games-frame-geometry--drawn', 390);
});
