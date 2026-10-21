/** Every finished Health check of one environment, including every rerun. */
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import type { Measurement } from '@pkgs/openslo-shared-ts/evaluate';

export const HEALTH_WORKFLOW_FILE = 'health.yml';
const RUN_LEAD_MS = 86_400_000;
export type GitHubSource = {
  readonly http: HttpClient;
  readonly apiUrl: string;
  readonly repository: string;
  readonly token: string;
};
export type HealthChecksQuery = {
  readonly env: string;
  readonly startMs: number;
  readonly endMs: number;
};

/** The workflow token needs Actions read permission. */
export function healthHistoryToken(
  vars: Readonly<Record<string, string | undefined>>
): string {
  const token = vars['GH_TOKEN']?.trim() || vars['GITHUB_TOKEN']?.trim() || '';
  if (!token)
    throw new Error(
      'GH_TOKEN or GITHUB_TOKEN is missing — Health history requires Actions read permission'
    );
  return token;
}
type Run = { readonly id: number; readonly run_attempt: number };
type Job = {
  readonly name: string;
  readonly status: string;
  readonly conclusion: string | null;
  readonly completed_at: string | null;
};

async function get<T>(source: GitHubSource, path: string): Promise<T> {
  const response = await source.http.fetch(
    `${source.apiUrl}/repos/${source.repository}/actions/${path}`,
    {
      headers: {
        Authorization: `Bearer ${source.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2026-03-10',
      },
    }
  );
  if (!response.ok)
    throw new Error(`GitHub ${path} answered ${String(response.status)}`);
  return (await response.json()) as T;
}

async function healthRuns(
  source: GitHubSource,
  query: HealthChecksQuery
): Promise<readonly Run[]> {
  const runs: Run[] = [];
  const since = new Date(query.startMs - RUN_LEAD_MS).toISOString();
  const until = new Date(query.endMs).toISOString();
  for (let page = 1; ; page++) {
    const result = await get<{ readonly workflow_runs: readonly Run[] }>(
      source,
      `workflows/${HEALTH_WORKFLOW_FILE}/runs?branch=main&created=${encodeURIComponent(`${since}..${until}`)}&per_page=100&page=${page}`
    );
    runs.push(...result.workflow_runs);
    if (result.workflow_runs.length < 100) return runs;
  }
}

async function runJobs(
  source: GitHubSource,
  run: Run
): Promise<readonly Job[]> {
  const jobs: Job[] = [];
  for (let attempt = 1; attempt <= run.run_attempt; attempt++) {
    for (let page = 1; ; page++) {
      const result = await get<{ readonly jobs: readonly Job[] }>(
        source,
        `runs/${run.id}/attempts/${attempt}/jobs?per_page=100&page=${page}`
      );
      jobs.push(...result.jobs);
      if (result.jobs.length < 100) break;
    }
  }
  return jobs;
}

/** Completed attempts in the inclusive window; cancelled and skipped checks do not count. */
export function jobEvent(
  job: Job,
  query: HealthChecksQuery
): { readonly atMs: number; readonly good: boolean } | null {
  if (
    job.status !== 'completed' ||
    ![
      'success',
      'failure',
      'timed_out',
      'action_required',
      'startup_failure',
      'stale',
    ].includes(job.conclusion ?? '')
  )
    return null;
  const atMs = Date.parse(job.completed_at ?? '');
  if (!(atMs >= query.startMs && atMs <= query.endMs)) return null;
  return { atMs, good: job.conclusion === 'success' };
}

export async function healthCheckEvents(
  source: GitHubSource,
  query: HealthChecksQuery
): Promise<Measurement> {
  const events = [];
  for (const run of await healthRuns(source, query)) {
    for (const job of await runJobs(source, run)) {
      if (job.name !== `health:${query.env}`) continue;
      const event = jobEvent(job, query);
      if (event !== null) events.push(event);
    }
  }
  events.sort((a, b) => a.atMs - b.atMs);
  return { kind: 'events', events };
}
