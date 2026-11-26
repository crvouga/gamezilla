#!/usr/bin/env bun
// @io-wall-ok — CI aggregation entry; reads job results, files the workflow's issue.
/**
 * The last job of Release and Health: the run's verdict from every job it
 * needs, in the job summary, and, on `main`, the workflow's one open GitHub
 * issue ("Release is failing on main", `ci-failure-issue.ts`), opened on the
 * first red run and closed by the next green one. Given the verdict Release
 * verification retained (`CI_VERDICT_PATH`), it also keeps one issue per
 * failing check (`ci-check-issues.ts`). Prints `passed=true|false`
 * to `GITHUB_OUTPUT` so the next step records the same verdict in Grafana
 * (`apps/product-ts/scripts/ci-workflow-result.ts`).
 *
 *   CI_WORKFLOW=Release NEEDS='${{ toJSON(needs) }}' bun run libs/tools-harness-ts/scripts/ci-workflow-alert.ts
 *
 * A job that failed, was cancelled (a timeout) or never reported is red; a
 * skipped job is not (Health yields to a Release under way). Exits 0: the
 * jobs it reads already decided the run, and a failure to file the issue
 * throws.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import {
  type FailedCheck,
  failedChecks,
  syncCheckIssues,
} from './ci-check-issues';
import { failureIssueTitle, fileFailureIssue } from './ci-failure-issue';
import type { Verdict } from './verify-verdict';

export type JobResults = Readonly<Record<string, { readonly result?: string }>>;

export type JobVerdict = { readonly job: string; readonly result: string };

const GREEN = new Set(['success', 'skipped']);

export function jobVerdicts(needs: JobResults): readonly JobVerdict[] {
  return Object.entries(needs).map(([job, value]) => ({
    job,
    result: value.result ?? 'missing',
  }));
}

export function redJobs(
  verdicts: readonly JobVerdict[]
): readonly JobVerdict[] {
  return verdicts.filter((verdict) => !GREEN.has(verdict.result));
}

export function formatWorkflowMarkdown(input: {
  readonly workflow: string;
  readonly verdicts: readonly JobVerdict[];
  readonly url: string;
  readonly sha: string;
  readonly checksWithoutPass?: readonly FailedCheck[];
}): string {
  const red = redJobs(input.verdicts);
  const checks = input.checksWithoutPass ?? [];
  const failing = checks.filter((check) => check.reason === 'failed');
  const incomplete = checks.length - failing.length;
  return [
    `## ${red.length === 0 ? '✅' : '❌'} ${input.workflow}`,
    '',
    `Commit \`${input.sha}\`. Logs and artifacts: ${input.url}`,
    '',
    '| Job | Result |',
    '|---|---|',
    ...input.verdicts.map(
      (verdict) =>
        `| \`${verdict.job}\` | ${GREEN.has(verdict.result) ? verdict.result.toUpperCase() : `**${verdict.result}**`} |`
    ),
    '',
    ...(incomplete
      ? [
          `Checks without a completed result: ${incomplete}. See the verification log for their names.`,
          '',
        ]
      : []),
    ...(failing.length === 0
      ? []
      : [
          'Failing checks:',
          '',
          ...failing.map(({ taskId }) => `- \`${taskId}\``),
          '',
        ]),
    ...(red.length === 0
      ? []
      : [
          'Read the red job’s log (not its name), fix the root cause on one pull request, and add the verification that would have caught it (`/ci-workflows-green`). This issue closes when the next run on main passes. Grafana retains the same verdict without push notifications.',
          '',
        ]),
  ].join('\n');
}

/** The verdict `verify:end` retained, or `null` when the run produced none. */
function readVerdict(path: string | undefined): Verdict | null {
  if (!path || !existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as Verdict;
}

function main(env: NodeJS.ProcessEnv): number {
  const workflow = env['CI_WORKFLOW']?.trim() || 'CI';
  const verdicts = jobVerdicts(JSON.parse(env['NEEDS'] ?? '{}') as JobResults);
  const red = redJobs(verdicts);
  const repository = env['GITHUB_REPOSITORY'] ?? '';
  const url = `${env['GITHUB_SERVER_URL'] ?? 'https://github.com'}/${repository}/actions/runs/${env['GITHUB_RUN_ID'] ?? ''}`;
  const sha = env['GITHUB_SHA'] ?? '';
  const verdict = readVerdict(env['CI_VERDICT_PATH']);
  const markdown = formatWorkflowMarkdown({
    workflow,
    verdicts,
    url,
    sha,
    checksWithoutPass: verdict ? failedChecks(verdict) : [],
  });
  if (env['GITHUB_STEP_SUMMARY'])
    appendFileSync(env['GITHUB_STEP_SUMMARY'], markdown);
  if (env['GITHUB_OUTPUT'])
    appendFileSync(
      env['GITHUB_OUTPUT'],
      `passed=${String(red.length === 0)}\n`
    );
  for (const verdict of red)
    console.log(
      `::error title=${workflow} · ${verdict.job}::${verdict.result}`
    );
  console.log(
    red.length === 0
      ? `${workflow}: every job passed`
      : `${workflow}: ${red.length} of ${verdicts.length} jobs did not pass`
  );
  // Only a run on `main` speaks for `main`; a rehearsed branch files nothing.
  if (env['GITHUB_REF'] === 'refs/heads/main') {
    const action = fileFailureIssue({
      repository,
      title: failureIssueTitle(workflow),
      markdown,
      red: red.length > 0,
      owner: env['CI_TRIAGE_OWNER'] ?? '',
      runUrl: url,
    });
    console.log(`${workflow}: issue ${action.kind}`);
    if (verdict) {
      const plan = syncCheckIssues({
        repository,
        verdict,
        run: { url, sha },
        owner: env['CI_TRIAGE_OWNER'] ?? '',
      });
      console.log(
        `${workflow}: check issues — ${plan.create.length} opened, ${plan.update.length} updated, ${plan.close.length} closed, ${plan.overflow.length} left to the workflow issue`
      );
    } else if (env['CI_VERDICT_PATH'])
      console.log(
        `::warning title=${workflow}::No verification verdict was retained; check issues are unchanged`
      );
  }
  return 0;
}

if (import.meta.main) process.exit(main(process.env));
