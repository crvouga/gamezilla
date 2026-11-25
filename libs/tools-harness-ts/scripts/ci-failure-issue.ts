// @io-wall-ok — CI helper; files the one open issue a red workflow on main keeps.
/**
 * One open GitHub issue per important workflow while it is red on `main`:
 * opened (and assigned) on the first red run, rewritten by each later red
 * run with the newest verdict, closed by the next green run. Verify Nightly
 * (`verify-nightly-verdict.ts`), Release and Health (`ci-workflow-alert.ts`)
 * file through here, so each has exactly one place people look. Release also
 * keeps one issue per failing check (`ci-check-issues.ts`).
 *
 * The body always says what is red now, when it went red and how many runs
 * have been red since; a later red run edits it instead of adding a comment,
 * so an hourly workflow does not bury the issue under its own reports.
 */
import { spawnSync } from 'node:child_process';

/** The label every CI failure issue carries, so they can be listed together. */
export const CI_FAILURE_LABEL = 'ci-failure';

/** `Release` → `Release is failing on main`. */
export function failureIssueTitle(workflow: string): string {
  return `${workflow} is failing on main`;
}

/** A failed API read is not evidence that no issue exists. */
export function checkedIssueOutput(result: {
  readonly status: number | null;
  readonly stdout: string | null;
  readonly stderr: string | null;
}): string {
  if (result.status !== 0)
    throw new Error(
      `CI failure issue reporting failed: ${result.stderr || result.status}`
    );
  return result.stdout?.trim() ?? '';
}

export type IssueAction =
  | { readonly kind: 'create' }
  | { readonly kind: 'update'; readonly issue: string }
  | { readonly kind: 'close'; readonly issues: readonly string[] }
  | { readonly kind: 'none' };

/** What a run does to the workflow's issue, from its verdict and the open issue. */
export function issueAction(
  red: boolean,
  open: readonly string[]
): IssueAction {
  const current = open[0];
  if (current === undefined) return { kind: red ? 'create' : 'none' };
  return red
    ? { kind: 'update', issue: current }
    : { kind: 'close', issues: open };
}

const HISTORY = /<!-- ci-failure red-since=(\S+) red-runs=(\d+) -->/;

/**
 * The report with its history appended: the run that first went red and how
 * many red runs there have been, carried over from the issue's last body.
 * Reporting the same run twice (a re-run job) counts it once.
 */
export function withRedHistory(
  markdown: string,
  previous: string | null,
  runUrl: string
): string {
  const history = previous === null ? null : HISTORY.exec(previous);
  const since = history?.[1] ?? runUrl;
  const before = history ? Number(history[2]) : 0;
  const repeated = previous?.includes(`<!-- ci-failure last-run=${runUrl} -->`);
  const runs = repeated ? Math.max(before, 1) : before + 1;
  return [
    markdown.trimEnd(),
    '',
    `Red since ${since}. Red runs since then: ${String(runs)}.`,
    '',
    `<!-- ci-failure red-since=${since} red-runs=${String(runs)} -->`,
    `<!-- ci-failure last-run=${runUrl} -->`,
    '',
  ].join('\n');
}

export type OpenIssue = {
  readonly number: string;
  readonly title: string;
  readonly body: string;
};

export function ghIssues(args: readonly string[]): string {
  return checkedIssueOutput(spawnSync('gh', args, { encoding: 'utf8' }));
}

/**
 * Every open CI failure issue. Listed by label, not searched: the search
 * index lags a write, and an issue it had not indexed yet was filed twice.
 */
export function openFailureIssues(repository: string): readonly OpenIssue[] {
  const found = JSON.parse(
    ghIssues([
      'issue',
      'list',
      '--repo',
      repository,
      '--state',
      'open',
      '--label',
      CI_FAILURE_LABEL,
      '--limit',
      '500',
      '--json',
      'number,title,body',
    ]) || '[]'
  ) as readonly { number: number; title: string; body: string }[];
  return found.map((issue) => ({
    number: String(issue.number),
    title: issue.title,
    body: issue.body,
  }));
}

/** The label may not exist yet in a fresh repository; create it once. */
export function ensureLabel(repository: string): void {
  ghIssues([
    'label',
    'create',
    CI_FAILURE_LABEL,
    '--repo',
    repository,
    '--color',
    'B60205',
    '--description',
    'An important CI workflow is failing on main',
    '--force',
  ]);
}

export function createFailureIssue(input: {
  readonly repository: string;
  readonly title: string;
  readonly body: string;
  readonly owner: string;
}): void {
  ghIssues([
    'issue',
    'create',
    '--repo',
    input.repository,
    '--title',
    input.title,
    '--label',
    CI_FAILURE_LABEL,
    ...(input.owner ? ['--assignee', input.owner] : []),
    '--body',
    input.body,
  ]);
}

export function updateFailureIssue(
  repository: string,
  issue: string,
  body: string
): void {
  ghIssues(['issue', 'edit', issue, '--repo', repository, '--body', body]);
}

export function closeFailureIssue(
  repository: string,
  issue: string,
  comment: string
): void {
  ghIssues([
    'issue',
    'close',
    issue,
    '--repo',
    repository,
    '--comment',
    comment,
  ]);
}

/** Keep one issue open while the workflow is red on `main`. Reporting failures throw. */
export function fileFailureIssue(input: {
  readonly repository: string;
  readonly title: string;
  readonly markdown: string;
  readonly red: boolean;
  readonly owner: string;
  readonly runUrl: string;
}): IssueAction {
  const open = openFailureIssues(input.repository).filter(
    (issue) => issue.title === input.title
  );
  const action = issueAction(
    input.red,
    open.map((issue) => issue.number)
  );
  const body = withRedHistory(
    input.markdown,
    open[0]?.body ?? null,
    input.runUrl
  );
  if (action.kind === 'create') {
    ensureLabel(input.repository);
    createFailureIssue({ ...input, body });
  } else if (action.kind === 'update') {
    updateFailureIssue(input.repository, action.issue, body);
  } else if (action.kind === 'close') {
    for (const issue of action.issues)
      closeFailureIssue(input.repository, issue, input.markdown);
  }
  return action;
}
