// @io-wall-ok — CI helper; files the one open issue a red workflow on main keeps.
/**
 * One open GitHub issue per important workflow while it is red on `main`:
 * opened (and assigned) on the first red run, commented on by each later red
 * run, closed by the next green run. Verify Nightly
 * (`verify-nightly-verdict.ts`), Release and Health (`ci-workflow-alert.ts`)
 * file through here, so each has exactly one place people look.
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
  | { readonly kind: 'comment'; readonly issue: string }
  | { readonly kind: 'close'; readonly issue: string }
  | { readonly kind: 'none' };

/** What a run does to the workflow's issue, from its verdict and the open issue. */
export function issueAction(red: boolean, open: string | null): IssueAction {
  if (red && open === null) return { kind: 'create' };
  if (red && open !== null) return { kind: 'comment', issue: open };
  if (open !== null) return { kind: 'close', issue: open };
  return { kind: 'none' };
}

function gh(args: readonly string[]): string {
  return checkedIssueOutput(spawnSync('gh', args, { encoding: 'utf8' }));
}

/** The open issue's number for this title, or `null`. */
function openIssue(repository: string, title: string): string | null {
  const found = gh([
    'issue',
    'list',
    '--repo',
    repository,
    '--state',
    'open',
    '--search',
    `in:title "${title}"`,
    '--json',
    'number,title',
    '--jq',
    `[.[] | select(.title == ${JSON.stringify(title)})][0].number // empty`,
  ]);
  return found === '' ? null : found;
}

/** The label may not exist yet in a fresh repository; create it once. */
function ensureLabel(repository: string): void {
  gh([
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

/** Keep one issue open while the workflow is red on `main`. Reporting failures throw. */
export function fileFailureIssue(input: {
  readonly repository: string;
  readonly title: string;
  readonly markdown: string;
  readonly red: boolean;
  readonly owner: string;
}): IssueAction {
  const action = issueAction(
    input.red,
    openIssue(input.repository, input.title)
  );
  if (action.kind === 'create') {
    ensureLabel(input.repository);
    gh([
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
      input.markdown,
    ]);
  } else if (action.kind === 'comment') {
    gh([
      'issue',
      'comment',
      action.issue,
      '--repo',
      input.repository,
      '--body',
      input.markdown,
    ]);
  } else if (action.kind === 'close') {
    gh([
      'issue',
      'close',
      action.issue,
      '--repo',
      input.repository,
      '--comment',
      input.markdown,
    ]);
  }
  return action;
}
