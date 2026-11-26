import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { ciStageTasks, isBlockingCiTask, PR_TASKS } from './ci-stage';
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

test('Release, nightly and local verification retain the complete catalog', () => {
  for (const stage of ['release', 'nightly', undefined, ''])
    expect(ciStageTasks(MAIN_VERIFY_TASKS, stage)).toEqual(MAIN_VERIFY_TASKS);
});

test('a pull request runs only the tasks that cannot wait for Release', () => {
  const pr = ciStageTasks(MAIN_VERIFY_TASKS, 'pr');
  expect([...pr].sort()).toEqual([...PR_TASKS].sort());
  expect(pr).toEqual([
    'tc',
    'lint',
    '@libs/tools-harness-ts#verify:actionlint',
    '@libs/tools-harness-ts#verify:secrets',
  ]);
  // Every pull-request task is a gate task: Release runs it again.
  for (const task of PR_TASKS) expect(MAIN_VERIFY_TASKS).toContain(task);
});

test('Release preserves irreversible-change and security safeguards before it deploys', () => {
  const tasks = ciStageTasks(MAIN_VERIFY_TASKS, 'release');
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
});

// regression: consistency-gates-nightly-only
test('Release holds main to the catalog, spec language and chart ownership gates', () => {
  const tasks = ciStageTasks(MAIN_VERIFY_TASKS, 'release');
  for (const task of [
    '@libs/tools-harness-ts#ci:i18n',
    '@libs/tools-harness-ts#ci:specs',
  ]) {
    expect(tasks).toContain(task);
    expect(isBlockingCiTask(task, tasks)).toBe(true);
  }
});

// regression: pr-gate-narrower-than-nightly
test('Release holds a commit to every gate task nightly runs before it deploys', () => {
  const nightly = ciStageTasks(MAIN_VERIFY_TASKS, 'nightly');
  const release = ciStageTasks(MAIN_VERIFY_TASKS, 'release');
  expect(release).toEqual(nightly);
  // Nightly's gate found these red on main 93782bb0a after they merged
  // green. Pull requests no longer run them by design: Release does, before
  // anything deploys, and files an issue per failing check.
  for (const task of [
    '@libs/tools-harness-ts#verify:brand-policy',
    '@libs/tools-harness-ts#verify:rebrand',
    '@libs/tools-harness-ts#ci:cache-hygiene',
    '@apps/product-api-ts#test',
    '@libs/billing-harness-ts#test',
    '@pkgs/ui-root-harness-ts#test',
    '@libs/runtime-client-ts#test',
    '@libs/infra-server-ts#test',
    '@libs/tools-harness-ts#test',
    '@libs/sokoban-harness-ts#test:spec:0',
    '@libs/light-cycles-harness-ts#test:spec:0',
    '@libs/games-harness-ts#test:contract:0',
    '@pkgs/ui-root-harness-ts#ci:storybook:0',
  ])
    expect(isBlockingCiTask(task, release)).toBe(true);
});

// regression: pr-gate-narrower-than-nightly
test('gate shards install every toolchain the gate catalog needs', () => {
  const workflow = verifyWorkflow();
  for (const job of ['verify-shards', 'verify-end']) {
    const setup = workflow.jobs[job]!.steps.find(
      (step) => step.uses === './.github/actions/setup'
    )!;
    expect(setup.with?.['tools']).toBe(
      "${{ env.VERIFY_CI_STAGE == 'pr' && 'bun node gh opentofu gitleaks actionlint' || '' }}"
    );
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
test('Release enforces the production-build journeys before it deploys', () => {
  const release = ciStageTasks(MAIN_VERIFY_TASKS, 'release');
  for (const task of RELEASE_JOURNEY_TASKS) {
    expect(release).toContain(task);
    expect(isBlockingCiTask(task, release)).toBe(true);
  }
  expect(new Set(release).size).toBe(release.length);
});

test('only a pull request runs the narrow selection; a dispatch, Release and nightly run the catalog', () => {
  expect(verifyWorkflow().env['VERIFY_CI_STAGE']).toBe(
    "${{ inputs.profile == 'nightly' && 'nightly' || (github.event_name == 'pull_request' && 'pr' || 'release') }}"
  );
});

test('Release and nightly select the whole catalog, and a pull request a subset of it, as it grows and changes order', () => {
  assertProperty(
    'ci-stage-whole-catalog',
    fc.property(
      fc.shuffledSubarray([...MAIN_VERIFY_TASKS, 'future:verification']),
      fc.constantFrom('pr', 'release', 'nightly', undefined, ''),
      (catalog, stage) => {
        const selected = ciStageTasks(catalog, stage);
        if (stage !== 'pr') return expect(selected).toEqual(catalog);
        expect(selected).toEqual(
          catalog.filter((task) => PR_TASKS.includes(task))
        );
        expect(selected).not.toContain('future:verification');
      }
    )
  );
});
