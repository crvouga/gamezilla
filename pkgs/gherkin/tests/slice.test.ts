/**
 * A slice registers every `count`-th scenario from `index`, so the slices of
 * one feature — each its own test file — run each scenario exactly once.
 */

import { expect, test } from 'bun:test';

import { runFeature } from '@pkgs/gherkin/bun-test';
import { setWorld, stepsFor } from '@pkgs/gherkin/registry';

type World = { readonly seen: string[] };

const seen: string[] = [];
const { Then } = stepsFor<World>();

setWorld<World>({
  create: async () => ({ seen }),
  dispose: async () => {},
});

Then('the slice world notes {string}', (w, name: string) => {
  w.seen.push(name);
});

const feature = `Feature: Sliced scenarios
${['a', 'b', 'c', 'd', 'e']
  .map(
    (name) => `  Scenario: ${name}\n    Then the slice world notes "${name}"\n`
  )
  .join('\n')}`;

for (const index of [0, 1]) {
  runFeature(feature, {
    packageName: '@pkgs/gherkin',
    featureUri: 'specs/gherkin/slice.feature',
    slice: { index, count: 2 },
  });
}

// Registered last, so it runs after both slices' scenarios.
test('the two slices ran every scenario once', () => {
  expect(seen).toEqual(['a', 'c', 'e', 'b', 'd']);
});
