import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CI_RUN_DEADLINE_SECONDS, taskBudgetSeconds } from './check-budget';
import {
  failedGroups,
  formatNightlyMarkdown,
  formatNightlyTable,
  nightlyGroupNames,
  nightlyGroups,
  tracksNightlyIssue,
} from './check-nightly-verdict';
import {
  activeProfile,
  applyProfileEnv,
  checkAggregatorTasks,
  localCheckArgs,
  NIGHTLY_SUITES,
  profileDeadlineSeconds,
  profileManifest,
  suiteDeadlineSeconds,
} from './check-profile';
import { flattenCheckAggregators, MAIN_CHECK_TASKS } from './turbo-ci-run';

// regression: deploy-journeys-missing-pr-browser-gate
test('PR verification runs the production-bundle journeys before deployment', () => {
  expect(MAIN_CHECK_TASKS).toContain('@apps/product#test:release-journeys');
});

const ROOT = join(import.meta.dirname, '../../..');
const NIGHTLY = { CHECK_PROFILE: 'nightly' };

type Step = {
  name?: string;
  run?: string;
  uses?: string;
  if?: string;
  'timeout-minutes'?: number | string;
  with?: Record<string, string>;
};
type Job = {
  name: string;
  needs?: string[];
  if?: string;
  uses?: string;
  with?: Record<string, string>;
  permissions?: Record<string, string>;
  'timeout-minutes'?: number;
  steps?: Step[];
};
type Workflow = {
  on: Record<string, unknown>;
  permissions: Record<string, string>;
  env: Record<string, string>;
  concurrency: { group: string; 'cancel-in-progress': boolean | string };
  jobs: Record<string, Job>;
};

function workflow(file: string): Workflow {
  return Bun.YAML.parse(
    readFileSync(join(ROOT, '.github/workflows', file), 'utf8')
  ) as Workflow;
}

describe('check profiles', () => {
  test('an unnamed profile is the merge gate, and an unknown one is refused', () => {
    expect(activeProfile({}).name).toBe('pr');
    expect(activeProfile({ CHECK_PROFILE: '' }).name).toBe('pr');
    expect(activeProfile(NIGHTLY).name).toBe('nightly');
    expect(() => activeProfile({ CHECK_PROFILE: 'weekly' })).toThrow(
      'not a check profile'
    );
  });

  test('the pr profile adds no depth and keeps no report', () => {
    const env: NodeJS.ProcessEnv = {};
    applyProfileEnv(env);
    expect(env).toEqual({});
    expect(activeProfile(env).reports).toBe(false);
    expect(activeProfile(env).continueAfterFailure).toBe(false);
    expect(profileDeadlineSeconds(env, true)).toBeNull();
    expect(taskBudgetSeconds('@pkgs/clock-shared#test', false, env)).toBe(300);
  });

  test('the nightly profile deepens the same tasks and keeps their reports', () => {
    const env: NodeJS.ProcessEnv = { ...NIGHTLY };
    applyProfileEnv(env);
    expect(env['QUINT_REPLAY_TRACES']).toBe('all');
    expect(Number(env['PBT_NUM_RUNS'])).toBeGreaterThan(40);
    expect(activeProfile(env).reports).toBe(true);
    expect(activeProfile(env).continueAfterFailure).toBe(true);
    // The depth is the only thing a nightly run needs to be run again.
    expect(profileManifest(env)).toEqual({
      profile: 'nightly',
      env: {
        QUINT_REPLAY_TRACES: 'all',
        PBT_NUM_RUNS: env['PBT_NUM_RUNS']!,
        HARNESS_FUZZ_SEEDS: env['HARNESS_FUZZ_SEEDS']!,
      },
      reproduce: `QUINT_REPLAY_TRACES=all PBT_NUM_RUNS=${env['PBT_NUM_RUNS']} HARNESS_FUZZ_SEEDS=${env['HARNESS_FUZZ_SEEDS']} bun check-nightly`,
    });
  });

  test('a depth a person asked for outranks the profile', () => {
    const env: NodeJS.ProcessEnv = { ...NIGHTLY, PBT_NUM_RUNS: '1000' };
    applyProfileEnv(env);
    expect(env['PBT_NUM_RUNS']).toBe('1000');
    expect(env['QUINT_REPLAY_TRACES']).toBe('all');
  });

  test('both profiles run the one gate task list; nightly only adds suites', () => {
    expect(checkAggregatorTasks('check', MAIN_CHECK_TASKS)).toEqual(
      MAIN_CHECK_TASKS
    );
    const nightly = checkAggregatorTasks('check-nightly', MAIN_CHECK_TASKS)!;
    expect(nightly.slice(0, MAIN_CHECK_TASKS.length)).toEqual([
      ...MAIN_CHECK_TASKS,
    ]);
    const suites = Object.values(NIGHTLY_SUITES).flatMap((suite) => [
      ...suite.tasks,
    ]);
    expect(nightly.slice(MAIN_CHECK_TASKS.length)).toEqual(suites);
    // A suite never repeats a task the gate already ran.
    for (const task of suites) expect(MAIN_CHECK_TASKS).not.toContain(task);
    expect(new Set(suites).size).toBe(suites.length);
    expect(checkAggregatorTasks('lint', MAIN_CHECK_TASKS)).toBeNull();
    expect(() =>
      checkAggregatorTasks('check-nightly:weekly', MAIN_CHECK_TASKS)
    ).toThrow('not a nightly suite');
  });

  test('every nightly suite task is a declared Turbo task', () => {
    const root = JSON.parse(readFileSync(join(ROOT, 'turbo.json'), 'utf8')) as {
      tasks: Record<string, unknown>;
    };
    const product = JSON.parse(
      readFileSync(join(ROOT, 'apps/product/turbo.json'), 'utf8')
    ) as { tasks: Record<string, unknown> };
    for (const suite of Object.keys(NIGHTLY_SUITES))
      for (const task of flattenCheckAggregators(
        [`check-nightly:${suite}`],
        {}
      )) {
        const [pkg, name] = task.split('#') as [string, string];
        expect(
          Object.hasOwn(root.tasks, task) ||
            (pkg === '@apps/product' && Object.hasOwn(product.tasks, name)),
          task
        ).toBe(true);
      }
  });

  test('the local commands name suites as groups', () => {
    expect(localCheckArgs(['--force'], {})).toEqual(['check', '--force']);
    expect(localCheckArgs([], NIGHTLY)).toEqual(['check-nightly']);
    expect(localCheckArgs(['gate'], NIGHTLY)).toEqual(['check']);
    expect(localCheckArgs(['random', 'coverage'], NIGHTLY)).toEqual([
      'check-nightly:random',
      'check-nightly:coverage',
    ]);
  });

  test('nightly budgets are bounded, and wider than the gate', () => {
    expect(taskBudgetSeconds('@pkgs/clock-shared#test', false, NIGHTLY)).toBe(
      300 * activeProfile(NIGHTLY).taskBudgetScale
    );
    expect(profileDeadlineSeconds(NIGHTLY, true)).toBeGreaterThan(
      CI_RUN_DEADLINE_SECONDS
    );
    // A suite task has its suite's deadline and no tighter budget.
    expect(taskBudgetSeconds('@apps/product#test:stack', true)).toBe(
      NIGHTLY_SUITES.browser.deadlineSeconds
    );
    expect(suiteDeadlineSeconds(['check-nightly:random'])).toBe(
      NIGHTLY_SUITES.random.deadlineSeconds
    );
    expect(suiteDeadlineSeconds(['check'])).toBeNull();
  });
});

describe('Check Nightly workflow', () => {
  const nightly = workflow('check-nightly.yml');
  const gate = workflow('check-pr.yml');

  // regression: ci-nightly-diagnostic-claims-full-verdict
  test('a successful diagnostic labels its log and report as partial verification', () => {
    const groups = nightlyGroups(
      { 'check-nightly-performance': { result: 'success' } },
      'performance'
    );
    const table = formatNightlyTable(groups, 'performance');
    expect(table).toContain('Nightly diagnostic: performance');
    expect(table).toContain('not a complete Nightly verdict');
    expect(table).toContain('Every selected diagnostic group passed');
    expect(table).not.toContain('Every nightly group passed');
    expect(
      formatNightlyMarkdown(groups, { url: 'run', sha: 'head' }, 'performance')
    ).toContain('Nightly diagnostic: performance');
  });

  test('diagnostics check only the requested scope and cannot stand for a full night', () => {
    expect(nightlyGroupNames()).toEqual([
      'gate',
      ...Object.keys(NIGHTLY_SUITES),
    ]);
    expect(nightlyGroupNames('visual')).toEqual(['gate', 'visual']);
    expect(nightlyGroupNames('random')).toEqual(['random']);
    expect(() => nightlyGroupNames('unknown')).toThrow('Unknown nightly group');
    const needs = {
      'check-nightly-gate': { result: 'skipped' },
      'check-nightly-random': { result: 'success' },
    };
    expect(failedGroups(nightlyGroups(needs, 'random'))).toEqual([]);
    expect(failedGroups(nightlyGroups(needs))).toHaveLength(5);
    expect(failedGroups(nightlyGroups({}, 'random'))[0]!.result).toBe(
      'missing'
    );
    expect(nightly.jobs['check-nightly-end']!.name).toContain(
      'check-nightly:diagnostic'
    );
    expect(tracksNightlyIssue('random', 'refs/heads/main')).toBe(false);
    expect(tracksNightlyIssue('all', 'refs/heads/main')).toBe(true);
    expect(tracksNightlyIssue('all', 'refs/heads/branch')).toBe(false);
  });

  test('runs every night on main and by hand, and never on a pull request', () => {
    expect(Object.keys(nightly.on).sort()).toEqual([
      'schedule',
      'workflow_dispatch',
    ]);
    expect(nightly.on['schedule']).toEqual([{ cron: '23 8 * * *' }]);
    expect(nightly.env['CHECK_PROFILE']).toBe('nightly');
    // A second night waits; it never discards the one still running.
    expect(nightly.concurrency['cancel-in-progress']).toBe(
      "${{ github.event_name == 'workflow_dispatch' && inputs.group != '' && inputs.group != 'all' }}"
    );
    // Dev secrets only, and no deploy: production stays out of reach.
    expect(nightly.env['SECRETS_ENV']).toBe('dev');
    const text = readFileSync(
      join(ROOT, '.github/workflows/check-nightly.yml'),
      'utf8'
    );
    expect(text).not.toMatch(/environment: production|deploy:local|AWS_ROLE/);
    expect(nightly.permissions).toEqual({ contents: 'read' });
  });

  test('the gate group is the Check PR jobs at nightly depth', () => {
    expect(nightly.jobs['check-nightly-gate']).toMatchObject({
      uses: './.github/workflows/check-pr.yml',
      with: { profile: 'nightly' },
    });
  });

  test('every suite is one job, and every job is a suite', () => {
    const groups = ['gate', ...Object.keys(NIGHTLY_SUITES)];
    expect(Object.keys(nightly.jobs).sort()).toEqual(
      [...groups, 'end'].map((group) => `check-nightly-${group}`).sort()
    );
    for (const [suite, config] of Object.entries(NIGHTLY_SUITES)) {
      const job = nightly.jobs[`check-nightly-${suite}`]!;
      const run = job.steps!.find(
        (step) => step.name === `check-nightly:${suite}`
      )!;
      expect(run.run).toContain(
        `libs/tools/scripts/turbo-ci-run.ts check-nightly:${suite}`
      );
      // The suite's own deadline fires first and names what was running.
      expect(Number(run['timeout-minutes']) * 60).toBeGreaterThan(
        config.deadlineSeconds
      );
      expect(job['timeout-minutes']! * 60).toBeGreaterThan(
        Number(run['timeout-minutes']) * 60
      );
      // Evidence is kept on failure too, and a red suite stops no other.
      const upload = job.steps!.find((step) =>
        step.uses?.startsWith('actions/upload-artifact@')
      )!;
      expect(upload.if).toBe('always() && !cancelled()');
      expect(upload.with!['name']).toBe(
        `check-nightly-${suite}-\${{ github.run_id }}`
      );
      expect(Number(upload.with!['retention-days'])).toBeGreaterThanOrEqual(14);
      expect(job.steps!.some((step) => 'continue-on-error' in step)).toBe(
        false
      );
    }
  });

  test('the ending word reads every group and fails on any red one', () => {
    const end = nightly.jobs['check-nightly-end']!;
    expect([...end.needs!].sort()).toEqual(
      Object.keys(nightly.jobs)
        .filter((job) => job !== 'check-nightly-end')
        .sort()
    );
    expect(end.if).toBe('always() && !cancelled()');
    expect(end.steps!.at(-1)!.run).toContain('check-nightly-verdict.ts');
    const needs = {
      'check-nightly-gate': { result: 'success' },
      'check-nightly-random': { result: 'failure' },
      'check-nightly-browser': { result: 'success' },
      'check-nightly-visual': { result: 'cancelled' },
      'check-nightly-coverage': { result: 'success' },
    };
    const groups = nightlyGroups(needs);
    // A group the workflow did not report is a failure, never a pass.
    expect(failedGroups(groups).map((group) => group.name)).toEqual([
      'random',
      'visual',
      'performance',
    ]);
    expect(formatNightlyTable(groups)).toContain(
      '3 of 6 nightly groups did not pass'
    );
    const markdown = formatNightlyMarkdown(groups, {
      url: 'https://example.test/run',
      sha: 'abc123',
    });
    expect(markdown).toContain('`bun check-nightly random`');
    expect(markdown).toContain('abc123');
    expect(
      failedGroups(
        nightlyGroups(
          Object.fromEntries(
            Object.keys(nightly.jobs)
              .filter((job) => job !== 'check-nightly-end')
              .map((job) => [job, { result: 'success' }])
          )
        )
      )
    ).toEqual([]);
  });

  test('the nightly shard deadline fires before its step timeout', () => {
    const step = gate.jobs['check-shards']!.steps!.find(
      (candidate) => candidate.name === 'check'
    )!;
    const minutes = /inputs\.profile == 'nightly' && (\d+) \|\|/.exec(
      String(step['timeout-minutes'])
    );
    expect(minutes).not.toBeNull();
    expect(Number(minutes![1]) * 60).toBeGreaterThan(
      profileDeadlineSeconds(NIGHTLY, true)!
    );
  });
});
