import { expect, test } from 'bun:test';
import { checkSpecs } from '@pkgs/gherkin-shared-ts/check';
import { extractSteps } from '@pkgs/gherkin-shared-ts/extract';
import { parseFeature } from '@pkgs/gherkin-shared-ts/parse';
import { parameterTypeRegistryFrom } from '@pkgs/gherkin-shared-ts/registry';

const SOURCE = `@domain:release
Feature: Release
  Scenario Outline: Unproven obligations cannot approve a release
    Given evidence is <state>
    When the team checks release
    Then release fails
    Examples:
      | state   |
      | missing |
      | stale   |
`;
function errors(source: string) {
  const feature = parseFeature(source, 'specs/release/release.feature');
  const definitions = extractSteps(
    `
Given('evidence is missing', () => undefined);
Given('evidence is stale', () => undefined);
When('the team checks release', () => undefined);
Then('release fails', () => undefined);
`,
    'tests/steps/release.steps.ts'
  ).steps;
  return checkSpecs({
    packages: [
      {
        name: '@example/release',
        domains: ['release'],
        features: [feature],
        definitions,
        imports: [],
      },
    ],
    shared: [],
    parameterTypes: parameterTypeRegistryFrom([]),
  });
}
test('expanded rows of one unnamed outline are not duplicate declarations', () => {
  // regression: gherkin-outline-name-collision
  expect(errors(SOURCE)).toEqual([]);
  expect(
    parseFeature(SOURCE, 'specs/release/release.feature').scenarios.map(
      (scenario) => scenario.name
    )
  ).toEqual([
    'Unproven obligations cannot approve a release [missing]',
    'Unproven obligations cannot approve a release [stale]',
  ]);
});
test('two declarations with the same name still fail', () => {
  expect(
    errors(
      SOURCE +
        `
  Scenario: Unproven obligations cannot approve a release
    Given evidence is missing
    When the team checks release
    Then release fails
`
    ).some((error) => error.includes('duplicate scenario name'))
  ).toBe(true);
});
