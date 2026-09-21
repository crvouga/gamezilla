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
  RUN_DEADLINE_ENV,
  resolveRunDeadlineSeconds,
  SLOW_RUNNER_MULTIPLIER,
  TASK_BUDGET_SECONDS,
  taskBudgetSeconds,
} from './check-budget';

function task(taskId: string, seconds: number, cacheStatus = 'MISS') {
  return {
    taskId,
    cache: { status: cacheStatus },
    execution: { startTime: 1_000, endTime: 1_000 + seconds * 1000 },
  };
}

describe('taskBudgetSeconds', () => {
  test('unlisted tasks get the default budget', () => {
    expect(taskBudgetSeconds('@libs/nope#test', false)).toBe(
      DEFAULT_TASK_BUDGET_SECONDS
    );
  });

  test('listed tasks get their own budget', () => {
    const listed = '@pkgs/sql-client-postgres#test:contract';
    expect(taskBudgetSeconds(listed, false)).toBe(TASK_BUDGET_SECONDS[listed]);
  });

  test('slow runners scale every budget by the same factor', () => {
    expect(taskBudgetSeconds('@libs/nope#test', true)).toBe(
      DEFAULT_TASK_BUDGET_SECONDS * SLOW_RUNNER_MULTIPLIER
    );
  });

  test('a prototype-named task does not inherit Object.prototype', () => {
    expect(taskBudgetSeconds('constructor', false)).toBe(
      DEFAULT_TASK_BUDGET_SECONDS
    );
    expect(taskBudgetSeconds('toString', false)).toBe(
      DEFAULT_TASK_BUDGET_SECONDS
    );
  });
});

describe('resolveRunDeadlineSeconds', () => {
  test('check and deploy have different ceilings', () => {
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
    // PR check sit for 90 minutes. The multiplier is for per-task budgets.
    expect(
      resolveRunDeadlineSeconds({}, { isDeploy: false, slowRunner: true })
    ).toBe(CI_RUN_DEADLINE_SECONDS);
  });

  test('deploy is not scaled either', () => {
    expect(
      resolveRunDeadlineSeconds({}, { isDeploy: true, slowRunner: true })
    ).toBe(DEPLOY_RUN_DEADLINE_SECONDS);
  });

  test('the CI deadline fires before the workflow step timeout', () => {
    // Otherwise GitHub kills the job first and nobody learns which task hung.
    const workflow = readFileSync(
      join(import.meta.dirname, '../../../.github/workflows/pr.yml'),
      'utf8'
    );
    const step = /- name: check\n(?:.*\n)*?\s+timeout-minutes:\s*(\d+)/.exec(
      workflow
    );
    expect(step, 'pr.yml check step has a timeout-minutes').not.toBeNull();
    expect(Number(step?.[1]) * 60).toBeGreaterThan(CI_RUN_DEADLINE_SECONDS);
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
      false
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
      false
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
    expect(report).toContain('check-budget.ts');
  });
});
