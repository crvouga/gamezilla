import { expect, test } from 'bun:test';
import {
  CHECK_ISSUE_PREFIX,
  checkIssueTitle,
  formatCheckIssue,
  MAX_CHECK_ISSUES,
  planCheckIssues,
} from './ci-check-issues';
import type { OpenIssue } from './ci-failure-issue';
import type { FailedTask, Verdict } from './verify-verdict';

function failed(taskId: string, reason: FailedTask['reason'] = 'failed') {
  return {
    taskId,
    shard: reason === 'missing' ? null : 3,
    exitCode: 1,
    reason,
  };
}

function verdict(tasks: readonly FailedTask[], start = 'success'): Verdict {
  return {
    passed: tasks.length === 0 && start === 'success',
    suites: [{ name: 'Unit tests', tasks: 40, failed: tasks }],
    jobs: [
      { name: 'verify:start', result: start },
      { name: 'verify:shards', result: tasks.length ? 'failure' : 'success' },
    ],
    failures: tasks.length,
  };
}

function issue(number: string, taskId: string): OpenIssue {
  return { number, title: checkIssueTitle(taskId), body: '' };
}

test('each failing check gets one issue: opened once, updated while red, closed when it passes', () => {
  const plan = planCheckIssues(
    verdict([failed('@a#test'), failed('@b#test')]),
    [
      issue('7', '@b#test'),
      issue('8', '@c#test'),
      { number: '9', title: 'Release is failing on main', body: '' },
    ]
  );
  expect(plan.create.map((check) => check.taskId)).toEqual(['@a#test']);
  expect(
    plan.update.map(({ issue, check }) => [issue.number, check.taskId])
  ).toEqual([['7', '@b#test']]);
  // The workflow's own issue is not a check issue and is never closed here.
  expect(plan.close.map((open) => open.number)).toEqual(['8']);
  expect(plan.overflow).toEqual([]);
});

test('a green verification closes every check issue', () => {
  const plan = planCheckIssues(verdict([]), [
    issue('7', '@b#test'),
    issue('8', '@c#test'),
  ]);
  expect(plan.close.map((open) => open.number)).toEqual(['7', '8']);
  expect(plan.create).toEqual([]);
});

test.each(['interrupted', 'missing'] as const)(
  'a %s check is neither filed nor closed',
  (reason) => {
    const plan = planCheckIssues(
      verdict([failed('@a#test', reason), failed('@b#test', reason)]),
      [issue('7', '@b#test')]
    );
    expect(plan.create).toEqual([]);
    expect(plan.update).toEqual([]);
    expect(plan.close).toEqual([]);
  }
);

test('a verdict without a plan names no check, so it closes nothing', () => {
  const noPlan: Verdict = {
    passed: false,
    suites: [],
    jobs: [{ name: 'verify:start', result: 'failure' }],
    failures: 0,
  };
  expect(planCheckIssues(noPlan, [issue('7', '@b#test')]).close).toEqual([]);
  expect(
    planCheckIssues(verdict([], 'failure'), [issue('7', '@b#test')]).close
  ).toEqual([]);
});

test('a run with one cause and many failures does not flood the queue', () => {
  const many = Array.from({ length: MAX_CHECK_ISSUES + 5 }, (_, index) =>
    failed(`@pkg-${String(index)}#test`)
  );
  const plan = planCheckIssues(verdict(many), [issue('7', '@other#test')]);
  // The stale issue closes, which leaves the whole budget to this run.
  expect(plan.create).toHaveLength(MAX_CHECK_ISSUES);
  expect(plan.overflow).toHaveLength(5);
  const full = planCheckIssues(
    verdict(many),
    many
      .slice(0, MAX_CHECK_ISSUES)
      .map((check, index) => issue(String(index), check.taskId))
  );
  expect(full.create).toEqual([]);
  expect(full.update).toHaveLength(MAX_CHECK_ISSUES);
  expect(full.overflow).toHaveLength(5);
});

test('the issue names the check, the run, where to read the failure and how to run it', () => {
  expect(checkIssueTitle('@a#test')).toBe(`${CHECK_ISSUE_PREFIX}@a#test`);
  const body = formatCheckIssue(
    { ...failed('@a#test'), suite: 'Unit tests' },
    { url: 'https://github.com/o/r/actions/runs/1', sha: 'abc' }
  );
  expect(body).toContain('`@a#test`');
  expect(body).toContain('https://github.com/o/r/actions/runs/1');
  expect(body).toContain('`verify:shards (3)`');
  expect(body).toContain('`bunx turbo run @a#test`');
  expect(body).toContain(
    'closes when a Release on `main` verifies this check green'
  );
});
