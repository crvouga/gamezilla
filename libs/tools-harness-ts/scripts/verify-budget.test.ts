import { describe, expect, test } from 'bun:test';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CI_RUN_DEADLINE_SECONDS,
  DEFAULT_RUN_DEADLINE_SECONDS,
  DEFAULT_TASK_BUDGET_SECONDS,
  DEPLOY_RUN_DEADLINE_SECONDS,
  findBudgetOverruns,
  formatBudgetOverruns,
  gateExitCode,
  RUN_DEADLINE_ENV,
  resolveRunDeadlineSeconds,
  SLOW_RUNNER_MULTIPLIER,
  slowCiRunner,
  TASK_BUDGET_SECONDS,
  taskBudgetSeconds,
  WARM_RUN_DEADLINE_SECONDS,
  WARM_RUNNER_MIN_CPUS,
} from './verify-budget';

function task(taskId: string, seconds: number, cacheStatus = 'MISS') {
  return {
    taskId,
    cache: { status: cacheStatus },
    execution: { startTime: 1_000, endTime: 1_000 + seconds * 1000 },
  };
}

describe('taskBudgetSeconds', () => {
  // regression: budget-examples-inherit-nightly-profile
  test('unlisted tasks get the default budget', () => {
    expect(taskBudgetSeconds('@libs/nope#test', false, {})).toBe(
      DEFAULT_TASK_BUDGET_SECONDS
    );
  });

  test('explicit profiles decide overruns at both runner speeds', () => {
    const summary = { tasks: [task('@libs/nope#test', 601)] };
    expect(findBudgetOverruns(summary, false, {})).toEqual([
      { taskId: '@libs/nope#test', seconds: 601, budgetSeconds: 300 },
    ]);
    expect(findBudgetOverruns(summary, true, {})).toEqual([
      { taskId: '@libs/nope#test', seconds: 601, budgetSeconds: 600 },
    ]);
    const nightly = { VERIFY_PROFILE: 'nightly' };
    expect(taskBudgetSeconds('@libs/nope#test', false, nightly)).toBe(1200);
    expect(taskBudgetSeconds('@libs/nope#test', true, nightly)).toBe(2400);
    expect(findBudgetOverruns(summary, false, nightly)).toEqual([]);
    expect(findBudgetOverruns(summary, true, nightly)).toEqual([]);
  });

  test('listed tasks get their own budget', () => {
    const listed = '@pkgs/sql-client-postgres#test:contract';
    expect(taskBudgetSeconds(listed, false, {})).toBe(
      TASK_BUDGET_SECONDS[listed] ?? Number.NaN
    );
  });

  // regression: game-conformance-serial-task-budget
  test('the 492-second combined game suite exceeds the unchanged budget of every contract part', () => {
    expect(
      findBudgetOverruns(
        { tasks: [task('@libs/games-harness-ts#test', 492)] },
        false,
        {}
      )
    ).toEqual([
      {
        taskId: '@libs/games-harness-ts#test',
        seconds: 492,
        budgetSeconds: 300,
      },
    ]);
    for (let part = 0; part < 5; part += 1)
      expect(
        taskBudgetSeconds(
          `@libs/games-harness-ts#test:contract:${part}`,
          false,
          {}
        )
      ).toBe(300);
  });

  test('split multiplayer proofs retain their existing allowance', () => {
    // regression: multiplayer-bounded-proof-timeout
    const withinAllowance = Array.from({ length: 16 }, () => 419);
    const summary = {
      tasks: withinAllowance.map((seconds, index) =>
        task(`@libs/games-harness-ts#verify:models:10:${index}`, seconds)
      ),
    };
    expect(findBudgetOverruns(summary, false, {})).toEqual([]);
    expect(
      findBudgetOverruns(
        { tasks: [task('@libs/games-harness-ts#verify:models:10:2', 421)] },
        false,
        {}
      )
    ).toEqual([
      {
        taskId: '@libs/games-harness-ts#verify:models:10:2',
        seconds: 421,
        budgetSeconds: 420,
      },
    ]);
  });

  // regression: games-spec-part-two-exceeds-task-budget
  test('the hashed custom-game-away part keeps its measured allowance', () => {
    const taskId = '@libs/games-harness-ts#test:spec:2';
    expect(taskBudgetSeconds(taskId, false, {})).toBe(420);
    expect(taskBudgetSeconds(taskId, true, {})).toBe(840);
    expect(
      findBudgetOverruns({ tasks: [task(taskId, 609)] }, true, {})
    ).toEqual([]);
  });

  test('slow runners scale every budget by the same factor', () => {
    expect(taskBudgetSeconds('@libs/nope#test', true, {})).toBe(
      DEFAULT_TASK_BUDGET_SECONDS * SLOW_RUNNER_MULTIPLIER
    );
  });

  test('a prototype-named task does not inherit Object.prototype', () => {
    expect(taskBudgetSeconds('constructor', false, {})).toBe(
      DEFAULT_TASK_BUDGET_SECONDS
    );
    expect(taskBudgetSeconds('toString', false, {})).toBe(
      DEFAULT_TASK_BUDGET_SECONDS
    );
  });
});

describe('resolveRunDeadlineSeconds', () => {
  // regression: release-wording-renames-deadline-option
  // Display wording is Release; the typed deadline option remains isDeploy.
  test('verification and release have different ceilings', () => {
    const opts = { slowRunner: false };
    expect(resolveRunDeadlineSeconds({}, { ...opts, isDeploy: false })).toBe(
      DEFAULT_RUN_DEADLINE_SECONDS
    );
    expect(resolveRunDeadlineSeconds({}, { ...opts, isDeploy: true })).toBe(
      DEPLOY_RUN_DEADLINE_SECONDS
    );
  });

  test('CI gets its own absolute ceiling, never a scaled one', () => {
    // Scaling the run deadline by the runner multiplier is what let a wedged
    // Verify run sit for 90 minutes. The multiplier is for per-task budgets.
    expect(
      resolveRunDeadlineSeconds({}, { isDeploy: false, slowRunner: true })
    ).toBe(CI_RUN_DEADLINE_SECONDS);
  });

  test('release is not scaled either', () => {
    expect(
      resolveRunDeadlineSeconds({}, { isDeploy: true, slowRunner: true })
    ).toBe(DEPLOY_RUN_DEADLINE_SECONDS);
  });

  // regression: health-timeout-hides-hung-probe
  test.each([
    ['verify-pr.yml', 'verify'],
    ['health.yml', 'health:${{ matrix.env }}'],
  ])('the CI deadline fires before the %s step timeout', (file, name) => {
    // Otherwise GitHub kills the job first and nobody learns which task hung.
    const workflow = readFileSync(
      join(import.meta.dirname, '../../../.github/workflows', file),
      'utf8'
    );
    // Only the step's own keys: stop at the next step (`- …`). The gate's
    // step names both profiles' timeouts; the `pr` one is the default read
    // here, and `verify-profile.test.ts` holds the nightly one.
    const step = new RegExp(
      `- name: ${RegExp.escape(name)}\\n(?:(?!\\s*- ).*\\n)*?\\s+timeout-minutes:\\s*(?:\\$\\{\\{ inputs\\.profile == 'nightly' && \\d+ \\|\\| )?(\\d+)`
    ).exec(workflow);
    expect(step, `${file} ${name} step has a timeout-minutes`).not.toBeNull();
    expect(Number(step?.[1]) * 60).toBeGreaterThan(CI_RUN_DEADLINE_SECONDS);
  });

  test('release verification installs Chrome without apt dependency upgrades', () => {
    const workflow = Bun.YAML.parse(
      readFileSync(
        join(import.meta.dirname, '../../../.github/workflows/verify-pr.yml'),
        'utf8'
      )
    ) as {
      jobs: Record<
        string,
        {
          'timeout-minutes'?: number;
          steps: {
            name?: string;
            uses?: string;
            'timeout-minutes'?: number;
          }[];
        }
      >;
    };
    const chrome = Object.values(workflow.jobs).flatMap((candidate) =>
      candidate.steps.filter((step) => step.uses?.includes('visual-renderer'))
    );
    expect(chrome.length).toBeGreaterThan(0);
    expect(chrome.every((step) => step['timeout-minutes'] === 2)).toBe(true);
    const renderer = readFileSync(
      join(
        import.meta.dirname,
        '../../../.github/actions/visual-renderer/action.yml'
      ),
      'utf8'
    );
    // regression: verify-chrome-apt-stalls-pr-gate
    expect(renderer).not.toMatch(/apt-get|install-dependencies: true/);
    // regression: windows-chrome-installer-needs-pwsh
    // mise unpacks the pinned Chrome on every OS; no installer action.
    expect(renderer).toContain('mise install http:chrome-for-testing');
    expect(renderer).not.toContain('setup-chrome');
  });

  test('only a small CI runner is slow; a warm one keeps the five-minute ceiling', () => {
    expect(slowCiRunner(false, 32)).toBe(false);
    expect(slowCiRunner(true, WARM_RUNNER_MIN_CPUS - 1)).toBe(true);
    expect(slowCiRunner(true, WARM_RUNNER_MIN_CPUS)).toBe(false);
    expect(
      resolveRunDeadlineSeconds(
        {},
        { isDeploy: false, slowRunner: false, warmRunner: true }
      )
    ).toBe(WARM_RUN_DEADLINE_SECONDS);
    expect(
      resolveRunDeadlineSeconds(
        {},
        { isDeploy: true, slowRunner: false, warmRunner: true }
      )
    ).toBe(DEPLOY_RUN_DEADLINE_SECONDS);
  });

  test('a deadline still fails the gate when turbo exits after the flush', () => {
    expect(
      gateExitCode({
        deadlineHit: true,
        signal: null,
        code: 0,
        published: true,
      })
    ).toBe(124);
    expect(
      gateExitCode({
        deadlineHit: false,
        signal: 'SIGTERM',
        code: 0,
        published: true,
      })
    ).toBe(124);
    expect(
      gateExitCode({
        deadlineHit: false,
        signal: null,
        code: 0,
        published: true,
      })
    ).toBe(0);
    expect(
      gateExitCode({
        deadlineHit: false,
        signal: null,
        code: null,
        published: false,
      })
    ).toBe(1);
  });

  test('a positive env override wins', () => {
    expect(
      resolveRunDeadlineSeconds(
        { [RUN_DEADLINE_ENV]: '90' },
        { isDeploy: false, slowRunner: true }
      )
    ).toBe(90);
  });

  test('a non-positive or junk override is ignored, never "off"', () => {
    for (const value of ['0', '-1', '', '  ', 'forever']) {
      expect(
        resolveRunDeadlineSeconds(
          { [RUN_DEADLINE_ENV]: value },
          { isDeploy: false, slowRunner: false }
        )
      ).toBe(DEFAULT_RUN_DEADLINE_SECONDS);
    }
  });
});

describe('findBudgetOverruns', () => {
  test('reports only tasks that executed and outran their budget', () => {
    const overruns = findBudgetOverruns(
      {
        tasks: [
          task('@a/slow#test', DEFAULT_TASK_BUDGET_SECONDS + 1),
          task('@a/ok#test', DEFAULT_TASK_BUDGET_SECONDS),
          task('@a/cached#test', DEFAULT_TASK_BUDGET_SECONDS + 999, 'HIT'),
        ],
      },
      false,
      {}
    );
    expect(overruns).toEqual([
      {
        taskId: '@a/slow#test',
        seconds: DEFAULT_TASK_BUDGET_SECONDS + 1,
        budgetSeconds: DEFAULT_TASK_BUDGET_SECONDS,
      },
    ]);
  });

  test('sorts slowest first', () => {
    const overruns = findBudgetOverruns(
      {
        tasks: [
          task('@a/less#test', DEFAULT_TASK_BUDGET_SECONDS + 10),
          task('@a/more#test', DEFAULT_TASK_BUDGET_SECONDS + 20),
        ],
      },
      false,
      {}
    );
    expect(overruns.map((o) => o.taskId)).toEqual([
      '@a/more#test',
      '@a/less#test',
    ]);
  });

  test('tolerates a summary with no tasks or no execution record', () => {
    expect(findBudgetOverruns({}, false)).toEqual([]);
    expect(
      findBudgetOverruns({ tasks: [{ taskId: '@a/b#c' }] }, false)
    ).toEqual([]);
  });

  test('names the task and both numbers in the report', () => {
    const report = formatBudgetOverruns([
      { taskId: '@a/slow#test', seconds: 400, budgetSeconds: 300 },
    ]);
    expect(report).toContain('@a/slow#test');
    expect(report).toContain('400s');
    expect(report).toContain('300s');
    expect(report).toContain('verify-budget.ts');
  });
});
