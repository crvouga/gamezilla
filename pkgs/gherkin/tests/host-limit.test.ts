/**
 * A step that hits a harness limit (`hostLimit`) ends its scenario as a pass:
 * the steps after it never run, and nothing reports it as a product failure.
 */

import { expect, test } from 'bun:test';

import { runFeature } from '@pkgs/gherkin/bun-test';
import { hostLimit, setWorld, stepsFor } from '@pkgs/gherkin/registry';

type World = { readonly seen: string[] };

const seen: string[] = [];
const { Given, When, Then } = stepsFor<World>();

setWorld<World>({
  create: async () => ({ seen }),
  dispose: async () => {},
});

Given('the host-limit world starts', (w) => {
  w.seen.push('start');
});
When('the host-limit step cannot run here', (w) => {
  w.seen.push('limit');
  throw hostLimit('this host cannot do that');
});
Then('the host-limit step after it runs', (w) => {
  w.seen.push('after');
});

runFeature(
  `Feature: Host limits
  Scenario: A step the host cannot run ends the scenario
    Given the host-limit world starts
    When the host-limit step cannot run here
    Then the host-limit step after it runs
`,
  { packageName: '@pkgs/gherkin', featureUri: 'features/host-limit.feature' }
);

test('the scenario stopped at the host limit and passed', () => {
  expect(seen).toEqual(['start', 'limit']);
});
