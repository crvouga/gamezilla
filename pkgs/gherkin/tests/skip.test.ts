/**
 * A scenario the host names in `skip` is never registered: the host decides
 * what it cannot run beside its bindings, never in the feature.
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

Then('the skip world notes {string}', (w, name: string) => {
  w.seen.push(name);
});

runFeature(
  `Feature: Skipped scenarios
  Scenario: A scenario this host runs
    Then the skip world notes "ran"

  Scenario: A scenario this host cannot run
    Then the skip world notes "skipped"
`,
  {
    packageName: '@pkgs/gherkin',
    featureUri: 'specs/gherkin/skip.feature',
    skip: ['A scenario this host cannot run'],
  }
);

test('only the scenario the host runs ran', () => {
  expect(seen).toEqual(['ran']);
});
