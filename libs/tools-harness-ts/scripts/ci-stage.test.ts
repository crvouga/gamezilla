import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import {
  ciStageTasks,
  deploymentTasks,
  isBlockingCiTask,
  PR_TASKS,
} from './ci-stage';
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
  for (const stage of ['nightly', undefined, ''])
    expect(ciStageTasks(MAIN_VERIFY_TASKS, stage)).toEqual(MAIN_VERIFY_TASKS);
});

test('a pull request runs only the tasks that cannot wait for Release', () => {
  const pr = ciStageTasks(MAIN_VERIFY_TASKS, 'pr');
  expect([...pr].sort()).toEqual([...PR_TASKS].sort());
  expect(pr).toEqual([
    'tc',
    'lint',
    'test',
    'test:unit:1',
    'test:unit:2',
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
test('Release retains integration and safety checks while Nightly exercises the Storybook corpus', () => {
  const nightly = ciStageTasks(MAIN_VERIFY_TASKS, 'nightly');
  const release = ciStageTasks(MAIN_VERIFY_TASKS, 'release');
  const stories = nightly.filter((task) =>
    task.startsWith('@pkgs/ui-root-harness-ts#ci:storybook:')
  );
  expect(stories.length).toBeGreaterThan(0);
  expect(release).toEqual(nightly.filter((task) => !stories.includes(task)));
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
    const tools = setup.with?.['tools'];
    if (job === 'verify-shards')
      expect(tools).toBe("${{ steps.tools.outputs.install || '' }}");
    else {
      expect(tools).toContain(
        "env.VERIFY_CI_STAGE == 'pr' && 'bun node gitleaks actionlint'"
      );
      expect(tools).toContain(
        "needs.verify-start.outputs.consumers == '-' && 'bun node'"
      );
    }
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

test('each stage keeps its selection as the catalog grows and changes order', () => {
  assertProperty(
    'ci-stage-whole-catalog',
    fc.property(
      fc.shuffledSubarray([...MAIN_VERIFY_TASKS, 'future:verification']),
      fc.constantFrom('pr', 'release', 'nightly', undefined, ''),
      (catalog, stage) => {
        const selected = ciStageTasks(catalog, stage);
        if (stage === 'release')
          return expect(selected).toEqual(
            catalog.filter(
              (task) =>
                !task.startsWith('@pkgs/ui-root-harness-ts#ci:storybook:')
            )
          );
        if (stage !== 'pr') return expect(selected).toEqual(catalog);
        expect(selected).toEqual(
          catalog.filter((task) => PR_TASKS.includes(task))
        );
        expect(selected).not.toContain('future:verification');
      }
    )
  );
});

test('the deployment verifies production bundles, billing, migrations, security and every critical journey', () => {
  const tasks = deploymentTasks(MAIN_VERIFY_TASKS);
  for (const task of [
    '@apps/product-ts#test:release-journeys:critical',
    '@libs/billing-harness-ts#test',
    '@libs/runtime-server-ts#verify:schema-evolution',
    '@libs/tools-harness-ts#ci:audit',
    '@apps/product-ts#verify:worker-bundle',
  ])
    expect(tasks).toContain(task);
  expect(tasks).not.toContain('test');
  expect(tasks).not.toContain('test:contract');
  expect(tasks).not.toContain('test:spec:0');
});
