import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { ciStageTasks, isBlockingCiTask } from './ci-stage';
import { MAIN_VERIFY_TASKS, RELEASE_JOURNEY_TASKS } from './turbo-ci-run';

type Workflow = {
  env: Record<string, string>;
  jobs: Record<
    string,
    { steps: { uses?: string; with?: Record<string, unknown> }[] }
  >;
};

function verifyWorkflow(): Workflow {
  return Bun.YAML.parse(
    readFileSync(
      join(import.meta.dirname, '../../../.github/workflows/verify-pr.yml'),
      'utf8'
    )
  ) as Workflow;
}

test('nightly and local verification retain the complete catalog', () => {
  expect(ciStageTasks(MAIN_VERIFY_TASKS, 'nightly')).toEqual(MAIN_VERIFY_TASKS);
  expect(ciStageTasks(MAIN_VERIFY_TASKS, undefined)).toEqual(MAIN_VERIFY_TASKS);
});

test('blocking stages preserve irreversible-change and security safeguards', () => {
  for (const stage of ['pr', 'release']) {
    const tasks = ciStageTasks(MAIN_VERIFY_TASKS, stage);
    for (const task of [
      'tc',
      'lint',
      'test',
      '@libs/tools-harness-ts#verify:secrets',
      '@libs/tools-harness-ts#verify:workflow-security',
      '@libs/runtime-server-ts#verify:schema-evolution',
      '@apps/product-ts#verify:worker-bundle',
      '@apps/synthetic-population-worker-ts#verify:synthetic-population-foundation',
    ])
      expect(tasks).toContain(task);
    for (const task of [
      '@libs/permissions-harness-ts#test',
      '@pkgs/db-migrate-shared-ts#test',
      '@pkgs/auth-root-harness-ts#test',
    ])
      expect(isBlockingCiTask(task, tasks)).toBe(true);
  }
});

// regression: consistency-gates-nightly-only
test('pull requests are held to the catalog, spec language and chart ownership gates', () => {
  for (const stage of ['pr', 'release']) {
    const tasks = ciStageTasks(MAIN_VERIFY_TASKS, stage);
    for (const task of [
      '@libs/tools-harness-ts#ci:i18n',
      '@libs/tools-harness-ts#ci:specs',
      '@libs/tools-harness-ts#ci:statecharts',
    ]) {
      expect(tasks).toContain(task);
      expect(isBlockingCiTask(task, tasks)).toBe(true);
    }
  }
});

// regression: pr-gate-narrower-than-nightly
test('PR and Release hold a change to every gate task nightly runs', () => {
  const nightly = ciStageTasks(MAIN_VERIFY_TASKS, 'nightly');
  for (const stage of ['pr', 'release'])
    expect(ciStageTasks(MAIN_VERIFY_TASKS, stage)).toEqual(nightly);
  // Nightly's gate found these red on main 93782bb0a after PR #287, PR #288
  // and commit e2cc4c093 each passed Verify: none was in the PR selection.
  const pr = ciStageTasks(MAIN_VERIFY_TASKS, 'pr');
  for (const task of [
    '@libs/tools-harness-ts#verify:brand-policy',
    '@libs/tools-harness-ts#verify:rebrand',
    '@libs/tools-harness-ts#ci:cache-hygiene',
    '@apps/server-ts#test',
    '@libs/billing-harness-ts#test',
    '@pkgs/ui-root-harness-ts#test',
    '@libs/runtime-client-ts#test',
    '@libs/infra-server-ts#test',
    '@libs/tools-harness-ts#test',
    '@libs/sokoban-harness-ts#test:spec:0',
    '@libs/light-cycles-harness-ts#test:spec:0',
    '@libs/games-harness-ts#test:contract:0',
    '@pkgs/ui-root-harness-ts#ci:storybook',
  ])
    expect(isBlockingCiTask(task, pr)).toBe(true);
});

// regression: pr-gate-narrower-than-nightly
test('gate shards install every toolchain the gate catalog needs', () => {
  const workflow = verifyWorkflow();
  for (const job of ['verify-shards', 'verify-end']) {
    const setup = workflow.jobs[job]!.steps.find(
      (step) => step.uses === './.github/actions/setup'
    )!;
    // Unset is the setup action's default: every pinned tool, lazy included,
    // which is what nightly's gate shards ran the same catalog with.
    expect(setup.with?.['tools']).toBeUndefined();
  }
});

test('a misspelled stage cannot silently remove verification', () => {
  expect(() => ciStageTasks(MAIN_VERIFY_TASKS, 'relese')).toThrow(
    'Unknown CI stage'
  );
});

// regression: release-schema-compared-to-itself
test('Release compares schema evolution against the pre-push commit', () => {
  expect(verifyWorkflow().env['PR_BASE']).toBe(
    "${{ github.event.pull_request.base.sha || github.event.before || format('{0}^', github.sha) }}"
  );
});

// regression: pr-omitted-release-journeys
test('PR and Release enforce the same production-build journeys', () => {
  const pr = ciStageTasks(MAIN_VERIFY_TASKS, 'pr');
  const release = ciStageTasks(MAIN_VERIFY_TASKS, 'release');
  expect(pr).toEqual(release);
  for (const task of RELEASE_JOURNEY_TASKS) {
    expect(pr).toContain(task);
    expect(isBlockingCiTask(task, pr)).toBe(true);
  }
  expect(new Set(pr).size).toBe(pr.length);
});

test('PR and manual prediction runs differ from reusable release and nightly runs', () => {
  expect(verifyWorkflow().env['VERIFY_CI_STAGE']).toBe(
    "${{ inputs.profile == 'nightly' && 'nightly' || (inputs.profile == 'release' && 'release' || 'pr') }}"
  );
});

test('every stage selects the whole catalog as it grows and changes order', () => {
  assertProperty(
    'ci-stage-whole-catalog',
    fc.property(
      fc.shuffledSubarray([...MAIN_VERIFY_TASKS, 'future:verification']),
      fc.constantFrom('pr', 'release', 'nightly', undefined, ''),
      (catalog, stage) => {
        expect(ciStageTasks(catalog, stage)).toEqual(catalog);
      }
    )
  );
});
