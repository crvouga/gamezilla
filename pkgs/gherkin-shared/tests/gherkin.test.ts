import { describe, expect, test } from 'bun:test';

import { checkSpecs } from '@pkgs/gherkin-shared/check';
import type { PackageSpecs } from '@pkgs/gherkin-shared/check';
import { extractStepImports, extractSteps } from '@pkgs/gherkin-shared/extract';
import { parseFeature } from '@pkgs/gherkin-shared/parse';
import { matchStep, parameterTypeRegistryFrom, stepsFor } from '@pkgs/gherkin-shared/registry';
import { nearDuplicates, normalizeStepText, sameBehavior } from '@pkgs/gherkin-shared/similarity';
import { specSmells } from '@pkgs/gherkin-shared/smells';
import { stubFileName, stubSource } from '@pkgs/gherkin-shared/stubs';
import { domainOf, isSyntheticFeatureSource, tagFilter } from '@pkgs/gherkin-shared/tags';

describe('feature parsing', () => {
  test('folds feature tags and Background steps into outline examples', () => {
    const feature = parseFeature(
      `@domain:friends
Feature: Requests
  Background:
    Given Alice is signed in

  @regression:ask-twice
  Scenario Outline: Ask <person>
    When Alice asks <person>
    Then <person> sees Alice

    Examples:
      | person |
      | Bob    |
      | Carol  |
`,
      'specs/friends/requests.feature'
    );

    expect(feature.name).toBe('Requests');
    expect(feature.scenarios.map((scenario) => scenario.name)).toEqual([
      'Ask Bob',
      'Ask Carol',
    ]);
    expect(feature.scenarios[0]?.tags).toEqual([
      '@domain:friends',
      '@regression:ask-twice',
    ]);
    expect(feature.scenarios[0]?.steps.map((step) => step.text)).toEqual([
      'Alice is signed in',
      'Alice asks Bob',
      'Bob sees Alice',
    ]);
  });
});

describe('step wording', () => {
  test('rejects UI mechanics and implementation words, not product names', () => {
    const feature = parseFeature(
      `@domain:auth
Feature: Signing in
  Scenario: Leaks
    When Alice clicks the sign-in button
    Then the API redirects to Google with the OAuth callback
    And the Postgres schema has every column

  Scenario: Behavior
    Then people are offered Google sign-in and not Apple sign-in
`,
      'specs/auth/sign-in.feature'
    );
    const { steps } = extractSteps(
      `
When('Alice clicks the sign-in button', () => undefined);
Then('the API redirects to Google with the OAuth callback', () => undefined);
Then('the Postgres schema has every column', () => undefined);
Then('people are offered Google sign-in and not Apple sign-in', () => undefined);
`,
      'tests/steps/index.ts'
    );

    const errors = checkSpecs({
      packages: [
        {
          name: '@apps/product',
          domains: ['auth'],
          features: [feature],
          definitions: steps,
          imports: [],
        },
      ],
      shared: [],
      parameterTypes: parameterTypeRegistryFrom([]),
    });

    expect(errors).toEqual([
      'specs/auth/sign-in.feature:4: step "Alice clicks the sign-in button" describes UI mechanics ("clicks"); say the intent instead',
      'specs/auth/sign-in.feature:5: step "the API redirects to Google with the OAuth callback" names implementation ("API"); say the product behavior instead',
      'specs/auth/sign-in.feature:6: step "the Postgres schema has every column" names implementation ("Postgres"); say the product behavior instead',
    ]);
  });
});

/** `checkSpecs` over one feature whose every step has a definition. */
function checkOne(
  source: string,
  uri: string,
  allowedImplementationWords?: ReadonlyMap<string, readonly string[]>
): readonly string[] {
  const feature = parseFeature(source, uri);
  const texts = [
    ...new Set(
      feature.scenarios.flatMap((sc) => sc.steps.map((st) => st.text))
    ),
  ];
  const { steps } = extractSteps(
    texts
      .map((text) => `Given(${JSON.stringify(text)}, () => undefined);`)
      .join('\n'),
    'tests/steps/index.ts'
  );
  const pkg: PackageSpecs = {
    name: '@libs/friends',
    domains: ['friends', 'journeys'],
    features: [feature],
    definitions: steps,
    imports: [],
  };
  return checkSpecs({
    packages: [pkg],
    shared: [],
    parameterTypes: parameterTypeRegistryFrom([]),
    ...(allowedImplementationWords === undefined
      ? {}
      : { allowedImplementationWords }),
  });
}

test('operator vocabulary is scoped and preserves other wording and shape checks', () => {
  const source = `@domain:friends
Feature: Maintenance
  Scenario: Snapshot
    Then the database is unchanged
`;
  const allowed = new Map([['friends', ['database']]]);
  expect(
    checkOne(source, 'specs/friends/maintenance.feature', allowed)
  ).toEqual([]);
  expect(
    checkOne(
      source,
      'specs/friends/maintenance.feature',
      new Map([['other', ['database']]])
    )
  ).toHaveLength(1);
  const unlisted = checkOne(
    source.replace('database', 'database schema'),
    'specs/friends/maintenance.feature',
    allowed
  );
  expect(unlisted[0]).toContain('names implementation ("schema")');
  const badShape = checkOne(
    source.replace(
      'Then the database is unchanged',
      'When Alice clicks a button'
    ),
    'specs/friends/maintenance.feature',
    allowed
  );
  expect(badShape).toEqual(
    expect.arrayContaining([
      expect.stringContaining('describes UI mechanics'),
      expect.stringContaining('has no Then'),
    ])
  );
});

describe('scenario shape', () => {
  test('rejects a narrator, a scenario with no outcome, and late context', () => {
    expect(
      checkOne(
        `@domain:friends
Feature: Requests
  Scenario: Narrated
    Given I am signed in
    When the user asks Bob
    Then Bob sees a request

  Scenario: No outcome
    Given Alice is signed in
    When Alice asks Bob

  Scenario: Late context
    When Alice asks Bob
    Given Bob is signed in
    Then Bob sees a request
`,
        'specs/friends/requests.feature'
      )
    ).toEqual([
      'specs/friends/requests.feature:4: step "I am signed in" is narrated ("I"); name the person (Alice, a guest) instead',
      'specs/friends/requests.feature:5: step "the user asks Bob" is narrated ("the user"); name the person (Alice, a guest) instead',
      'specs/friends/requests.feature:8: scenario "No outcome" has no Then; every scenario states an outcome',
      'specs/friends/requests.feature:14: Given "Bob is signed in" comes after the scenario acted; context goes first (or split the scenario)',
    ]);
  });
});

describe('smells', () => {
  const opts = {
    maxSteps: 4,
    maxActions: 1,
    journeyDomains: new Set(['journeys']),
    suspectWords: ['server'],
  };

  test('warns on scripts, several events, re-acting, architecture words and a missing why', () => {
    const feature = parseFeature(
      `@domain:friends
Feature: Requests
  Scenario: Script
    Given Alice is signed in
    When Alice asks Bob
    Then Bob sees a request
    When Bob accepts
    Then the server holds a friendship
`,
      'specs/friends/requests.feature'
    );
    expect(specSmells([feature], opts)).toEqual([
      'specs/friends/requests.feature: feature "Requests" has no description; say why the capability matters',
      'specs/friends/requests.feature:3: scenario "Script" has 5 steps (over 4); lift the steps to intent or split it',
      'specs/friends/requests.feature:3: scenario "Script" has 2 When steps (over 1); one event per scenario',
      'specs/friends/requests.feature:3: scenario "Script" acts again after a Then; that is usually one scenario per rule',
      'specs/friends/requests.feature:8: step "the server holds a friendship" mentions "server"; say what a person observes instead',
    ]);
  });

  test('lets a journey act again after a Then', () => {
    const feature = parseFeature(
      `@domain:journeys
Feature: Journeys
  The flows that must never break.

  Scenario: Host and end
    When Alice hosts a space
    Then the space is open
    When Alice ends the space
    Then the space has ended
`,
      'specs/journeys/journeys.feature'
    );
    expect(specSmells([feature], { ...opts, maxActions: 2 })).toEqual([]);
  });
});

describe('step definitions', () => {
  test('extracts literal definitions, pending bodies, and package imports', () => {
    const source = `
import '@libs/harness/spec/steps/platform';
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
      '@libs/harness/spec/steps/platform',
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
  test('evaluates official tag expressions and extracts the domain', () => {
    const tags = ['@domain:friends', '@regression:bug-1', '@fast'];
    expect(tagFilter('@fast and not @slow')(tags)).toBe(true);
    expect(tagFilter('@slow or @broken')(tags)).toBe(false);
    expect(domainOf(tags)).toBe('friends');
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
    expect(stubFileName('specs/spaces/live-presence.feature')).toBe(
      'spaces-live-presence.feature.test.ts'
    );
    const source = stubSource({
      bridge: '/repo/pkgs/gherkin-server/src/bun-test.ts',
      featurePath: '/repo/specs/friends/remove.feature',
      featureUri: 'specs/friends/remove.feature',
      packageName: '@libs/friends',
      stepsEntry: '/repo/libs/friends-harness/tests/steps/friends.ts',
    });
    expect(source).toContain('import { runFeature }');
    expect(source).toContain('specs/friends/remove.feature');
    expect(source).not.toContain('skip');
    expect(
      stubSource({
        bridge: '/repo/pkgs/gherkin-server/src/bun-test.ts',
        featurePath: '/repo/specs/friends/remove.feature',
        featureUri: 'specs/friends/remove.feature',
        packageName: '@libs/friends',
        stepsEntry: '/repo/libs/friends-harness/tests/steps/friends.ts',
        skip: ['Alice removes Bob'],
      })
    ).toContain('skip: ["Alice removes Bob"]');
    expect(source).not.toContain('reportDir');
    expect(
      stubSource({
        bridge: '/repo/pkgs/gherkin-server/src/bun-test.ts',
        featurePath: '/repo/specs/auth/sign-in.feature',
        featureUri: 'specs/auth/sign-in.feature',
        packageName: '@apps/product',
        stepsEntry: '/repo/apps/product/tests/steps/product.ts',
        reportDir: '/repo/apps/product/.cache/health-report',
        layer: 'release',
      })
    ).toContain(
      'reportDir: "/repo/apps/product/.cache/health-report", layer: "release"'
    );
  });
});

describe('isSyntheticFeatureSource', () => {
  test('the feature line carries the exact tag', () => {
    expect(
      isSyntheticFeatureSource('@domain:auth @synthetic\nFeature: Signing in\n')
    ).toBe(true);
    expect(
      isSyntheticFeatureSource('@domain:auth\nFeature: Signing in\n')
    ).toBe(false);
    expect(
      isSyntheticFeatureSource(
        '@domain:auth\nFeature: Signing in\n  @synthetic\n  Scenario: x\n'
      )
    ).toBe(false);
    expect(
      isSyntheticFeatureSource(
        '@domain:auth @synthetic-production\nFeature: Signing in\n'
      )
    ).toBe(false);
  });
});
