import { describe, expect, test } from 'bun:test';

import { extractStepImports, extractSteps } from '@pkgs/gherkin/extract';
import { parseFeature } from '@pkgs/gherkin/parse';
import {
  matchStep,
  parameterTypeRegistryFrom,
  stepsFor,
} from '@pkgs/gherkin/registry';
import {
  nearDuplicates,
  normalizeStepText,
  sameBehavior,
} from '@pkgs/gherkin/similarity';
import { stubFileName, stubSource } from '@pkgs/gherkin/stubs';
import { domainOf, goalsOf, tagFilter } from '@pkgs/gherkin/tags';

describe('feature parsing', () => {
  test('folds feature tags and Background steps into outline examples', () => {
    const feature = parseFeature(
      `@domain:friends
Feature: Requests
  Background:
    Given Alice is signed in

  @goal:social:5
  Scenario Outline: Ask <person>
    When Alice asks <person>
    Then <person> sees Alice

    Examples:
      | person |
      | Bob    |
      | Carol  |
`,
      'features/requests.feature'
    );

    expect(feature.name).toBe('Requests');
    expect(feature.scenarios.map((scenario) => scenario.name)).toEqual([
      'Ask Bob',
      'Ask Carol',
    ]);
    expect(feature.scenarios[0]?.tags).toEqual([
      '@domain:friends',
      '@goal:social:5',
    ]);
    expect(feature.scenarios[0]?.steps.map((step) => step.text)).toEqual([
      'Alice is signed in',
      'Alice asks Bob',
      'Bob sees Alice',
    ]);
  });
});

describe('step definitions', () => {
  test('extracts literal definitions, pending bodies, and package imports', () => {
    const source = `
import '@libs/sim-harness/spec/steps/platform';
import { helper } from '@libs/profile/steps/profile.steps';
Given('a literal', () => helper());
Then("a pending result", pending('later'));
When(expression, () => undefined);
`;
    const extracted = extractSteps(source, 'tests/steps/index.ts');

    expect(
      extracted.steps.map((step) => [step.kind, step.text, step.pending])
    ).toEqual([
      ['Given', 'a literal', false],
      ['Then', 'a pending result', true],
    ]);
    expect(extracted.problems).toHaveLength(1);
    expect(extractStepImports(source)).toEqual([
      '@libs/profile/steps/profile.steps',
      '@libs/sim-harness/spec/steps/platform',
    ]);
  });

  test('matches custom parameters and reports undefined steps', () => {
    const { Given } = stepsFor<{ readonly seen: string[] }>();
    Given('a uniquely registered {int} item', (world, count: number) => {
      world.seen.push(String(count));
    });

    const match = matchStep('a uniquely registered 3 item');
    expect(match.kind).toBe('match');
    if (match.kind === 'match') expect(match.args).toEqual([3]);
    expect(matchStep('no definition has this wording')).toEqual({
      kind: 'undefined',
    });
  });

  test('builds an isolated parameter registry', () => {
    const registry = parameterTypeRegistryFrom([
      {
        name: 'actor',
        regexp: /Alice|Bob/,
        transformer: (value) => value.toLowerCase(),
      },
    ]);
    expect(registry.lookupByTypeName('actor')).toBeDefined();
  });
});

describe('tags and catalogs', () => {
  test('evaluates official tag expressions and extracts domain goals', () => {
    const tags = ['@domain:friends', '@goal:social:5', '@fast'];
    expect(tagFilter('@fast and not @slow')(tags)).toBe(true);
    expect(tagFilter('@slow or @broken')(tags)).toBe(false);
    expect(domainOf(tags)).toBe('friends');
    expect(goalsOf(tags)).toEqual(['social:5']);
  });

  test('flags only same-kind wording aliases with equal parameter arity', () => {
    expect(normalizeStepText("Alice's own friends are still open")).toEqual([
      'alice',
      'own',
      'friend',
      'still',
      'open',
    ]);
    expect(sameBehavior(['friend', '_'], ['friend', '_', 'again'])).toBe(true);
    expect(sameBehavior(['friend', '_'], ['friend', '_', '_'])).toBe(false);
    const items = [
      { kind: 'Then', text: '{actor} can ask {actor}' },
      { kind: 'Then', text: '{actor} can ask {actor} again' },
      { kind: 'When', text: '{actor} can ask {actor} again' },
    ];
    const duplicates = nearDuplicates(
      items,
      (item) => item.text,
      (item) => item.kind
    );
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]?.a).toBe(items[0]);
    expect(duplicates[0]?.b).toBe(items[1]);
  });

  test('generates stable test stubs', () => {
    expect(stubFileName('features/spaces/live-presence.feature')).toBe(
      'spaces-live-presence.feature.test.ts'
    );
    const source = stubSource({
      bridge: '/repo/pkgs/gherkin/src/bun-test.ts',
      featurePath: '/repo/libs/friends/features/remove.feature',
      featureUri: 'features/remove.feature',
      packageName: '@libs/friends',
      stepsEntry: '/repo/libs/friends/tests/steps/index.ts',
    });
    expect(source).toContain('import { runFeature }');
    expect(source).toContain('features/remove.feature');
  });
});
