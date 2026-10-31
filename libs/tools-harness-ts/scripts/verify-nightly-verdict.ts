#!/usr/bin/env bun
// @io-wall-ok — CI aggregation entry; reads job results, files the nightly issue.
/**
 * The verdict `verify-nightly:end` gives a nightly run. Every group ran to its
 * own result, so one red group never hides another; any group that did not
 * succeed fails the night.
 *
 * Prints the table, appends it to `GITHUB_STEP_SUMMARY` with the artifact and
 * the command that runs each group again, and keeps one open issue for a red
 * `main`: opened on the first red night, commented on each later one, closed
 * by the next green night.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { NIGHTLY_SUITES } from './verify-profile';

/** `needs`, as the workflow serializes it. */
export type NeedsResults = Readonly<
  Record<string, { readonly result?: string }>
>;

export type NightlyGroup = {
  readonly name: string;
  readonly summary: string;
  readonly result: string;
  readonly reproduce: string;
};

const JOB_PREFIX = 'verify-nightly-';
const ISSUE_TITLE = 'Verify Nightly is failing on main';
const GATE_SUMMARY =
  'The whole merge gate at nightly depth: every Quint trace, five times the property runs';

function groupSummary(name: string): string {
  if (name === 'gate') return GATE_SUMMARY;
  if (name === 'storybook')
    return 'Storybook browser comparisons and retained pixel evidence';
  return Object.hasOwn(NIGHTLY_SUITES, name)
    ? NIGHTLY_SUITES[name as keyof typeof NIGHTLY_SUITES].summary
    : 'Unknown group';
}

/** One group per upstream job; a job the workflow did not report is a failure. */
export function nightlyGroupNames(selection = 'all'): readonly string[] {
  const names = ['gate', ...Object.keys(NIGHTLY_SUITES)];
  if (selection === 'all') return names;
  if (selection === 'storybook') return [selection];
  if (!names.includes(selection))
    throw new Error(`Unknown nightly group: ${selection}`);
  return selection === 'visual' ? ['gate', 'visual'] : [selection];
}

export function tracksNightlyIssue(
  selection: string,
  ref: string | undefined
): boolean {
  return selection === 'all' && ref === 'refs/heads/main';
}

function reproduceGroup(name: string): string {
  return name === 'storybook'
    ? 'bun storybook:test'
    : `bun verify-nightly ${name}`;
}

export function nightlyGroups(
  needs: NeedsResults,
  selection = 'all'
): readonly NightlyGroup[] {
  if (selection !== 'all')
    return nightlyGroupNames(selection).map((name) => ({
      name,
      summary: groupSummary(name),
      result: needs[`${JOB_PREFIX}${name}`]?.result ?? 'missing',
      reproduce: reproduceGroup(name),
    }));
  const names = ['gate', ...Object.keys(NIGHTLY_SUITES)];
  const reported = Object.keys(needs)
    .filter(
      (job) =>
        job !== 'verify-nightly-storybook' || needs[job]?.result !== 'skipped'
    )
    .map((job) =>
      job.startsWith(JOB_PREFIX) ? job.slice(JOB_PREFIX.length) : job
    );
  return [...new Set([...names, ...reported])].map((name) => ({
    name,
    summary: groupSummary(name),
    result: needs[`${JOB_PREFIX}${name}`]?.result ?? 'missing',
    reproduce: reproduceGroup(name),
  }));
}

export function failedGroups(
  groups: readonly NightlyGroup[]
): readonly NightlyGroup[] {
  return groups.filter((group) => group.result !== 'success');
}

export function formatNightlyTable(
  groups: readonly NightlyGroup[],
  selection = 'all'
): string {
  const width = Math.max(...groups.map((group) => group.name.length));
  const failed = failedGroups(groups);
  const scope = selection === 'all' ? 'nightly' : 'selected diagnostic';
  return [
    selection === 'all'
      ? 'Nightly verification'
      : `Nightly diagnostic: ${selection} (not a complete Nightly verdict)`,
    '',
    ...groups.map(
      (group) =>
        `${group.name.padEnd(width + 2)}${group.result === 'success' ? 'PASS' : group.result.toUpperCase()}`
    ),
    '',
    failed.length === 0
      ? `Every ${scope} group passed`
      : `${failed.length} of ${groups.length} ${scope} groups did not pass`,
  ].join('\n');
}

export function formatNightlyMarkdown(
  groups: readonly NightlyGroup[],
  run: { readonly url: string; readonly sha: string },
  selection = 'all'
): string {
  const failed = failedGroups(groups);
  return [
    `## ${failed.length === 0 ? '✅' : '❌'} ${selection === 'all' ? 'Nightly verification' : `Nightly diagnostic: ${selection}`}`,
    '',
    `Commit \`${run.sha}\`. Logs and artifacts: ${run.url}`,
    '',
    '| Group | Result | What it runs | Run it again |',
    '|---|---|---|---|',
    ...groups.map(
      (group) =>
        `| \`verify-nightly:${group.name}\` | ${group.result === 'success' ? 'PASS' : `**${group.result}**`} | ${group.summary} | \`${group.reproduce}\` |`
    ),
    '',
    ...(failed.length === 0
      ? []
      : [
          'Check out the commit above and run the command of a red group. Its job log names the failing task, the seed it drew and the replay command; its artifact holds the reports. Pin what it found as a regression in the suite that found it, so the merge gate replays it from then on.',
          '',
        ]),
  ].join('\n');
}

function gh(args: readonly string[]): { status: number; out: string } {
  const result = spawnSync('gh', args, { encoding: 'utf8' });
  if (result.status !== 0) console.error(result.stderr);
  return { status: result.status ?? 1, out: result.stdout.trim() };
}

/** The open nightly issue's number, or `null`. */
function openIssue(repository: string): string | null {
  const found = gh([
    'issue',
    'list',
    '--repo',
    repository,
    '--state',
    'open',
    '--search',
    `in:title "${ISSUE_TITLE}"`,
    '--json',
    'number',
    '--jq',
    '.[0].number // empty',
  ]);
  return found.status === 0 && found.out !== '' ? found.out : null;
}

/** Keep one issue open while `main` is red at night. Never decides the verdict. */
function fileIssue(repository: string, markdown: string, red: boolean): void {
  const issue = openIssue(repository);
  if (red && issue === null)
    gh([
      'issue',
      'create',
      '--repo',
      repository,
      '--title',
      ISSUE_TITLE,
      '--body',
      markdown,
    ]);
  else if (red && issue !== null)
    gh(['issue', 'comment', issue, '--repo', repository, '--body', markdown]);
  else if (issue !== null)
    gh(['issue', 'close', issue, '--repo', repository, '--comment', markdown]);
}

function main(env: NodeJS.ProcessEnv): number {
  const selection = env['NIGHTLY_GROUP'] || 'all';
  const groups = nightlyGroups(
    JSON.parse(env['NEEDS'] ?? '{}') as NeedsResults,
    selection
  );
  const failed = failedGroups(groups);
  const repository = env['GITHUB_REPOSITORY'] ?? '';
  const report = formatNightlyMarkdown(
    groups,
    {
      url: `${env['GITHUB_SERVER_URL'] ?? 'https://github.com'}/${repository}/actions/runs/${env['GITHUB_RUN_ID'] ?? ''}`,
      sha: env['GITHUB_SHA'] ?? '',
    },
    selection
  );
  const markdown =
    selection === 'all'
      ? report
      : `Diagnostic scope: ${selection}. This is not a complete Nightly verdict.\n\n${report}`;
  if (env['GITHUB_STEP_SUMMARY'])
    appendFileSync(env['GITHUB_STEP_SUMMARY'], markdown);
  console.log(formatNightlyTable(groups, selection));
  for (const group of failed)
    console.log(
      `::error title=verify-nightly:${group.name}::${group.result} — ${group.summary}`
    );
  // Only a night on `main` speaks for `main`; a rehearsed branch files nothing.
  if (tracksNightlyIssue(selection, env['GITHUB_REF']))
    fileIssue(repository, markdown, failed.length > 0);
  return failed.length === 0 ? 0 : 1;
}

if (import.meta.main) process.exit(main(process.env));
