// @io-wall-ok — browser verification adapter; all requests stay on the static server
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { visualScenarios } from '../../storybook/scenarios';
import { verifyStoryScenario } from './verify-story-scenario';

type Entry = { id: string; type: string; importPath: string };
const index = JSON.parse(
  readFileSync(
    new URL('../../.cache/storybook/index.json', import.meta.url),
    'utf8'
  )
) as { entries: Record<string, Entry> };
for (const story of Object.values(index.entries).filter(
  (e) => e.type === 'story'
)) {
  for (const scenario of visualScenarios(story)) {
    // This exact matrix entry is registered literally below.
    if (
      story.id === 'primitives-sparkline--states' &&
      scenario.theme === 'dark' &&
      scenario.width === 390
    )
      continue;
    const { theme, suffix } = scenario;
    test(`${story.id} ${theme}${suffix}`, async ({ page }) => {
      await verifyStoryScenario(page, story.id, scenario);
    });
  }
}

// regression: storybook-ubuntu-renderer-baselines
test('primitives-sparkline--states dark', async ({ page }) => {
  const story = index.entries['primitives-sparkline--states'];
  expect(story).toBeDefined();
  const scenario = visualScenarios(story!).find(
    (candidate) => candidate.theme === 'dark' && candidate.width === 390
  );
  expect(scenario).toBeDefined();
  await verifyStoryScenario(page, 'primitives-sparkline--states', scenario!);
});
