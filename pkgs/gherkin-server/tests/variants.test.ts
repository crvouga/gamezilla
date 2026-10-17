/**
 * A host can run a scenario once per variant it defines (one per subject the
 * scenario holds for), each in a fresh world, and a failure names every
 * variant that failed while the others still run.
 */

import { expect, test } from 'bun:test';

import { runFeature } from '@pkgs/gherkin-server/bun-test';
import type { ScenarioContext } from '@pkgs/gherkin-shared/registry';
import {
  defineScenarioVariants,
  setWorld,
  stepsFor,
} from '@pkgs/gherkin-shared/registry';

type World = { readonly variant: string; readonly testId: string };

const worlds: World[] = [];
const { Given, Then } = stepsFor<World>();

setWorld<World>({
  create: async (ctx: ScenarioContext) => {
    const world = { variant: ctx.variant?.id ?? 'none', testId: ctx.testId };
    worlds.push(world);
    return world;
  },
  dispose: async () => {},
});

defineScenarioVariants((ctx) =>
  ctx.scenarioName.startsWith('Every')
    ? [
        { id: 'first', label: 'the first subject' },
        { id: 'second', label: 'the second subject' },
      ]
    : null
);

Given('a subject', () => {});
Then('the subject holds', () => {});

runFeature(
  `Feature: Variants
  Scenario: Every subject holds
    Given a subject
    Then the subject holds

  Scenario: One run holds
    Given a subject
    Then the subject holds
`,
  {
    packageName: '@pkgs/gherkin',
    featureUri: 'specs/gherkin/variants.feature',
  }
);

test('a varied scenario runs once per variant in its own world; others run once', () => {
  expect(worlds.map((world) => world.variant)).toEqual([
    'first',
    'second',
    'none',
  ]);
  expect(new Set(worlds.map((world) => world.testId)).size).toBe(3);
  expect(worlds[0]?.testId).toBe('variants.every-subject-holds.first');
});
