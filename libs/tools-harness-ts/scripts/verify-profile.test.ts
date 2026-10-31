import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NIGHTLY_REPLAY_SCALE } from '@libs/harness-ts/spec-parts';
import {
  flattenVerifyAggregators,
  MAIN_VERIFY_TASKS,
  RELEASE_JOURNEY_PARTS,
  RELEASE_JOURNEY_TASKS,
} from './turbo-ci-run';
import { CI_RUN_DEADLINE_SECONDS, taskBudgetSeconds } from './verify-budget';
import {
  failedGroups,
  formatNightlyMarkdown,
  formatNightlyTable,
  nightlyGroupNames,
  nightlyGroups,
  tracksNightlyIssue,
} from './verify-nightly-verdict';
import {
  activeProfile,
  applyProfileEnv,
  localVerifyArgs,
  NIGHTLY_SUITES,
  profileDeadlineSeconds,
  profileManifest,
  suiteDeadlineSeconds,
  verifyAggregatorTasks,
} from './verify-profile';

// regression: deploy-journeys-missing-pr-browser-gate
test('PR verification runs the production-bundle journeys before release', () => {
  for (const task of RELEASE_JOURNEY_TASKS)
    expect(MAIN_VERIFY_TASKS).toContain(task);
});

const ROOT = join(import.meta.dirname, '../../..');
const NIGHTLY = { VERIFY_PROFILE: 'nightly' };

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

describe('verification profiles', () => {
  test('an unnamed profile is the whole gate, and an unknown one is refused', () => {
    expect(activeProfile({}).name).toBe('release');
    expect(activeProfile({ VERIFY_PROFILE: '' }).name).toBe('release');
    // regression: release-cold-slow-suites
    expect(() => activeProfile({ VERIFY_PROFILE: 'pr' })).toThrow(
      'not a verification profile'
    );
    expect(activeProfile(NIGHTLY).name).toBe('nightly');
    expect(() => activeProfile({ VERIFY_PROFILE: 'weekly' })).toThrow(
      'not a verification profile'
    );
  });

  test('the release profile adds no depth and keeps no report', () => {
    const env: NodeJS.ProcessEnv = {};
    applyProfileEnv(env);
    expect(env).toEqual({});
    expect(activeProfile(env).reports).toBe(false);
    expect(activeProfile(env).continueAfterFailure).toBe(false);
    expect(profileDeadlineSeconds(env, true)).toBeNull();
    expect(taskBudgetSeconds('@pkgs/clock-shared-ts#test', false, env)).toBe(
      300
    );
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
      reproduce: `QUINT_REPLAY_TRACES=all PBT_NUM_RUNS=${env['PBT_NUM_RUNS']} HARNESS_FUZZ_SEEDS=${env['HARNESS_FUZZ_SEEDS']} bun verify-nightly`,
    });
  });

  test('a depth a person asked for outranks the profile', () => {
    const env: NodeJS.ProcessEnv = { ...NIGHTLY, PBT_NUM_RUNS: '1000' };
    applyProfileEnv(env);
    expect(env['PBT_NUM_RUNS']).toBe('1000');
    expect(env['QUINT_REPLAY_TRACES']).toBe('all');
  });

  test('both profiles run the one gate task list; nightly only adds suites', () => {
    expect(verifyAggregatorTasks('verify', MAIN_VERIFY_TASKS)).toEqual(
      MAIN_VERIFY_TASKS
    );
    const nightly = verifyAggregatorTasks('verify-nightly', MAIN_VERIFY_TASKS)!;
    expect(nightly.slice(0, MAIN_VERIFY_TASKS.length)).toEqual([
      ...MAIN_VERIFY_TASKS,
    ]);
    const suites = Object.values(NIGHTLY_SUITES).flatMap((suite) => [
      ...suite.tasks,
    ]);
    expect(nightly.slice(MAIN_VERIFY_TASKS.length)).toEqual(suites);
    // A suite never repeats a task the gate already ran.
    for (const task of suites) expect(MAIN_VERIFY_TASKS).not.toContain(task);
    expect(new Set(suites).size).toBe(suites.length);
    expect(verifyAggregatorTasks('lint', MAIN_VERIFY_TASKS)).toBeNull();
    expect(() =>
      verifyAggregatorTasks('verify-nightly:weekly', MAIN_VERIFY_TASKS)
    ).toThrow('not a nightly suite');
  });

  // regression: nightly-package-task-declaration
  // regression: nightly-package-owned-tasks
  test('every nightly suite task is a declared Turbo task', () => {
    const root = JSON.parse(readFileSync(join(ROOT, 'turbo.json'), 'utf8')) as {
      tasks: Record<string, unknown>;
    };
    for (const suite of Object.keys(NIGHTLY_SUITES))
      for (const task of flattenVerifyAggregators(
        [`verify-nightly:${suite}`],
        {}
      )) {
        const [pkg, name] = task.split('#') as [string, string];
        const file = join(ROOT, pkg.slice(1), 'turbo.json');
        const owner = existsSync(file)
          ? (JSON.parse(readFileSync(file, 'utf8')) as {
              tasks: Record<string, unknown>;
            })
          : { tasks: {} };
        expect(
          Object.hasOwn(root.tasks, task) || Object.hasOwn(owner.tasks, name),
          task
        ).toBe(true);
      }
  });

  test('the local commands name suites as groups', () => {
    expect(localVerifyArgs(['--force'], {})).toEqual(['verify', '--force']);
    expect(localVerifyArgs([], NIGHTLY)).toEqual(['verify-nightly']);
    expect(localVerifyArgs(['gate'], NIGHTLY)).toEqual(['verify']);
    expect(localVerifyArgs(['random', 'coverage'], NIGHTLY)).toEqual([
      'verify-nightly:random',
      'verify-nightly:coverage',
    ]);
  });

  test('a planned spec part may replay nightly what its nightly budget allows', () => {
    // The spec split caps a part's nightly replays at the gate's cap times
    // NIGHTLY_REPLAY_SCALE: the scale of the nightly per-task budget.
    expect(NIGHTLY_REPLAY_SCALE).toBe(activeProfile(NIGHTLY).taskBudgetScale);
    expect(activeProfile({}).taskBudgetScale).toBe(1);
  });

  test('nightly budgets are bounded, and wider than the gate', () => {
    expect(
      taskBudgetSeconds('@pkgs/clock-shared-ts#test', false, NIGHTLY)
    ).toBe(300 * activeProfile(NIGHTLY).taskBudgetScale);
    expect(profileDeadlineSeconds(NIGHTLY, true)).toBeGreaterThan(
      CI_RUN_DEADLINE_SECONDS
    );
    // A suite task has its suite's deadline and no tighter budget.
    expect(
      taskBudgetSeconds('@apps/product-ts#test:stack', true, NIGHTLY)
    ).toBe(NIGHTLY_SUITES.browser.deadlineSeconds);
    expect(suiteDeadlineSeconds(['verify-nightly:random'])).toBe(
      NIGHTLY_SUITES.random.deadlineSeconds
    );
    expect(suiteDeadlineSeconds(['verify'])).toBeNull();
  });
});

describe('Verify Nightly workflow', () => {
  const nightly = workflow('verify-nightly.yml');
  const gate = workflow('verify-pr.yml');

  // regression: ci-nightly-diagnostic-claims-full-verdict
  test('a successful diagnostic labels its log and report as partial verification', () => {
    const groups = nightlyGroups(
      { 'verify-nightly-performance': { result: 'success' } },
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

  test('diagnostics verify only the requested scope and cannot stand for a full night', () => {
    expect(nightlyGroupNames()).toEqual([
      'gate',
      ...Object.keys(NIGHTLY_SUITES),
    ]);
    expect(nightlyGroupNames('visual')).toEqual(['gate', 'visual']);
    expect(nightlyGroupNames('random')).toEqual(['random']);
    expect(() => nightlyGroupNames('unknown')).toThrow('Unknown nightly group');
    const needs = {
      'verify-nightly-gate': { result: 'skipped' },
      'verify-nightly-random': { result: 'success' },
    };
    expect(failedGroups(nightlyGroups(needs, 'random'))).toEqual([]);
    expect(failedGroups(nightlyGroups(needs))).toHaveLength(5);
    expect(failedGroups(nightlyGroups({}, 'random'))[0]!.result).toBe(
      'missing'
    );
    expect(nightly.jobs['verify-nightly-end']!.name).toContain(
      'verify-nightly:diagnostic'
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
    expect(nightly.on['schedule']).toEqual([{ cron: '23 10 * * *' }]);
    expect(nightly.env['VERIFY_PROFILE']).toBe('nightly');
    // A second night waits; it never discards the one still running.
    expect(nightly.concurrency['cancel-in-progress']).toBe(
      "${{ github.event_name == 'workflow_dispatch' && inputs.group != '' && inputs.group != 'all' }}"
    );
    // Dev secrets only, and no release: production stays out of reach.
    expect(nightly.env['SECRETS_ENV']).toBe('dev');
    const text = readFileSync(
      join(ROOT, '.github/workflows/verify-nightly.yml'),
      'utf8'
    );
    expect(text).not.toMatch(/environment: production|deploy:local|AWS_ROLE/);
    expect(nightly.permissions).toEqual({ contents: 'read' });
  });

  test('the gate group is the Verify PR jobs at nightly depth', () => {
    expect(nightly.jobs['verify-nightly-gate']).toMatchObject({
      uses: './.github/workflows/verify-pr.yml',
      with: { profile: 'nightly' },
    });
  });

  test('every suite is one job, and every job is a suite', () => {
    const groups = ['gate', ...Object.keys(NIGHTLY_SUITES), 'storybook'];
    expect(Object.keys(nightly.jobs).sort()).toEqual(
      [...groups, 'end'].map((group) => `verify-nightly-${group}`).sort()
    );
    for (const [suite, config] of Object.entries(NIGHTLY_SUITES)) {
      const job = nightly.jobs[`verify-nightly-${suite}`]!;
      const run = job.steps!.find(
        (step) => step.name === `verify-nightly:${suite}`
      )!;
      expect(run.run).toContain(
        `libs/tools-harness-ts/scripts/turbo-ci-run.ts verify-nightly:${suite}`
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
        step.run?.includes('scripts/ci-artifacts.ts upload')
      )!;
      expect(upload.if).toBe('always() && !cancelled()');
      expect(upload.run).toContain(
        `ci-artifacts.ts upload verify-nightly-${suite}-"\${GITHUB_RUN_ID}"`
      );
      expect(job.steps!.some((step) => 'continue-on-error' in step)).toBe(
        false
      );
    }
  });

  test('the ending word reads every group and fails on any red one', () => {
    const end = nightly.jobs['verify-nightly-end']!;
    expect([...end.needs!].sort()).toEqual(
      Object.keys(nightly.jobs)
        .filter((job) => job !== 'verify-nightly-end')
        .sort()
    );
    expect(end.if).toBe('always() && !cancelled()');
    expect(end.steps!.at(-1)!.run).toContain('verify-nightly-verdict.ts');
    const needs = {
      'verify-nightly-gate': { result: 'success' },
      'verify-nightly-random': { result: 'failure' },
      'verify-nightly-browser': { result: 'success' },
      'verify-nightly-visual': { result: 'cancelled' },
      'verify-nightly-coverage': { result: 'success' },
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
    expect(markdown).toContain('`bun verify-nightly random`');
    expect(markdown).toContain('abc123');
    expect(
      failedGroups(
        nightlyGroups(
          Object.fromEntries(
            Object.keys(nightly.jobs)
              .filter((job) => job !== 'verify-nightly-end')
              .map((job) => [job, { result: 'success' }])
          )
        )
      )
    ).toEqual([]);
  });

  test('the nightly shard deadline fires before its step timeout', () => {
    const step = gate.jobs['verify-shards']!.steps!.find(
      (candidate) => candidate.name === 'verify'
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

// regression: release-cold-slow-suites
describe('the gate', () => {
  test('a pull request runs every gate task Release runs', () => {
    const gate = [...MAIN_VERIFY_TASKS];
    expect(verifyAggregatorTasks('verify', gate)).toEqual(gate);
    for (const slow of [
      'test:spec:0',
      'verify:models',
      'test:contract',
      ...RELEASE_JOURNEY_TASKS,
      'verify:board-contract',
    ])
      expect(gate).toContain(slow);
  });
});

// regression: release-journeys-outran-task-budget
test('the release journeys are split into parts that the scripts, turbo and the gate agree on', () => {
  const product = JSON.parse(
    readFileSync(join(ROOT, 'apps/product-ts/package.json'), 'utf8')
  ) as { scripts: Record<string, string> };
  const turbo = JSON.parse(readFileSync(join(ROOT, 'turbo.json'), 'utf8')) as {
    tasks: Record<string, unknown>;
  };
  expect(RELEASE_JOURNEY_TASKS).toHaveLength(RELEASE_JOURNEY_PARTS);
  for (const [part, task] of RELEASE_JOURNEY_TASKS.entries()) {
    expect(MAIN_VERIFY_TASKS).toContain(task);
    expect(turbo.tasks[task]).toBeDefined();
    expect(product.scripts[`test:release-journeys:${String(part)}`]).toBe(
      `bun run scripts/test-release-journeys.ts --part=${String(part)}/${String(RELEASE_JOURNEY_PARTS)}`
    );
  }
  // The undivided task is no longer part of the gate: it outran its budget.
  expect(MAIN_VERIFY_TASKS).not.toContain(
    '@apps/product-ts#test:release-journeys'
  );
});
