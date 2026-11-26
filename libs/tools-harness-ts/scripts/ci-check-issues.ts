// @io-wall-ok — CI helper; keeps one open issue per check failing in Release on main.
/**
 * A pull request runs four tasks (`ci-stage.ts`); every other check runs in
 * Release, on the merged commit. A check that fails there is work someone
 * has to pick up, so each one keeps its own open issue: opened on the first
 * red Release, rewritten by each later one with the newest run, closed by the
 * first Release whose verification has that check passing. One issue per
 * check is one unit of work, taken and fixed independently of the others.
 *
 * `ci-workflow-alert.ts` calls this with the verdict `verify:end` retained
 * (`release-verdict`). A check without a verdict (its shard crashed or was
 * cancelled) is neither filed nor closed: the workflow's own issue reports
 * the run, and nothing is known about the check.
 */
import {
  closeFailureIssue,
  createFailureIssue,
  ensureLabel,
  type OpenIssue,
  openFailureIssues,
  updateFailureIssue,
  withRedHistory,
} from './ci-failure-issue';
import type { FailedTask, Verdict } from './verify-verdict';

export const CHECK_ISSUE_PREFIX = 'Release check failing on main: ';

/**
 * The most check issues open at once. A run with more failures than this has
 * one cause (a broken build, a dead dependency), and the workflow's issue
 * names every failing check; one issue each would bury the queue.
 */
export const MAX_CHECK_ISSUES = 20;

export type FailedCheck = FailedTask & { readonly suite: string };

export function checkIssueTitle(taskId: string): string {
  return `${CHECK_ISSUE_PREFIX}${taskId}`;
}

/** Every failing task of a verdict, in report order. */
export function failedChecks(verdict: Verdict): readonly FailedCheck[] {
  return verdict.suites.flatMap((suite) =>
    suite.failed.map((task) => ({ ...task, suite: suite.name }))
  );
}

/**
 * Whether a check absent from the failures is known to have passed: only
 * when the plan exists (`verify:start` succeeded), since a verdict without a
 * plan lists no task at all.
 */
export function verdictNamesEveryCheck(verdict: Verdict): boolean {
  return (
    verdict.suites.length > 0 &&
    verdict.jobs.some(
      (job) => job.name === 'verify:start' && job.result === 'success'
    )
  );
}

export type CheckIssuePlan = {
  readonly create: readonly FailedCheck[];
  readonly update: readonly {
    readonly issue: OpenIssue;
    readonly check: FailedCheck;
  }[];
  readonly close: readonly OpenIssue[];
  /** Failing checks left to the workflow's issue by {@link MAX_CHECK_ISSUES}. */
  readonly overflow: readonly FailedCheck[];
};

/** What a Release's verdict does to the open check issues. */
export function planCheckIssues(
  verdict: Verdict,
  open: readonly OpenIssue[]
): CheckIssuePlan {
  const issues = new Map(
    open
      .filter((issue) => issue.title.startsWith(CHECK_ISSUE_PREFIX))
      .map((issue) => [issue.title.slice(CHECK_ISSUE_PREFIX.length), issue])
  );
  const failed = failedChecks(verdict);
  const decided = failed.filter((check) => check.reason === 'failed');
  const update = decided.flatMap((check) => {
    const issue = issues.get(check.taskId);
    return issue ? [{ issue, check }] : [];
  });
  const fresh = decided.filter((check) => !issues.has(check.taskId));
  const failing = new Set(failed.map((check) => check.taskId));
  const close = verdictNamesEveryCheck(verdict)
    ? [...issues].flatMap(([taskId, issue]) =>
        failing.has(taskId) ? [] : [issue]
      )
    : [];
  const room = Math.max(0, MAX_CHECK_ISSUES - (issues.size - close.length));
  return {
    create: fresh.slice(0, room),
    update,
    close,
    overflow: fresh.slice(room),
  };
}

export type CheckRun = { readonly url: string; readonly sha: string };

function whereToRead(check: FailedCheck): string {
  return check.shard === null
    ? 'the run summary'
    : `the log of \`verify:shards (${String(check.shard)})\``;
}

export function formatCheckIssue(check: FailedCheck, run: CheckRun): string {
  return [
    `## ❌ \`${check.taskId}\``,
    '',
    'This check fails in Release verification on `main`. Pull requests do not run it, so it stays red, and Release stays blocked, until it is fixed here.',
    '',
    '| | |',
    '|---|---|',
    `| Suite | ${check.suite} |`,
    `| Result | ${check.reason} (exit ${String(check.exitCode)}) |`,
    `| Commit | \`${run.sha}\` |`,
    `| Newest red run | ${run.url} |`,
    `| Evidence | ${whereToRead(check)} |`,
    `| Run it | \`bunx turbo run ${check.taskId}\` |`,
    '',
    'Read the failure in the log, fix the root cause on one pull request, and pin what broke as a regression. Dispatch `verify-full.yml` on the branch to run the whole gate before merging. This issue closes when a Release on `main` verifies this check green.',
    '',
  ].join('\n');
}

/** Reconcile the open check issues with a Release's verdict. Reporting failures throw. */
export function syncCheckIssues(input: {
  readonly repository: string;
  readonly verdict: Verdict;
  readonly run: CheckRun;
  readonly owner: string;
}): CheckIssuePlan {
  const plan = planCheckIssues(
    input.verdict,
    openFailureIssues(input.repository)
  );
  if (plan.create.length > 0) ensureLabel(input.repository);
  for (const check of plan.create)
    createFailureIssue({
      repository: input.repository,
      title: checkIssueTitle(check.taskId),
      body: withRedHistory(
        formatCheckIssue(check, input.run),
        null,
        input.run.url
      ),
      owner: input.owner,
    });
  for (const { issue, check } of plan.update)
    updateFailureIssue(
      input.repository,
      issue.number,
      withRedHistory(
        formatCheckIssue(check, input.run),
        issue.body,
        input.run.url
      )
    );
  for (const issue of plan.close)
    closeFailureIssue(
      input.repository,
      issue.number,
      `Passing in Release verification of \`${input.run.sha}\`: ${input.run.url}`
    );
  return plan;
}
