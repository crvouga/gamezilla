/**
 * The team's regular outside checks of one environment, as GitHub Actions
 * recorded them: every finished `health:<env>` job of the Health workflow
 * (`.github/workflows/health.yml`) in a window, one event each, good when
 * the job succeeded. Read through the GitHub REST API with an injected HTTP
 * client, so a test answers with recorded pages and never opens a socket.
 *
 * Every attempt of a run counts (`filter=all`): a re-run is another check.
 * A job that never ran its checks (`skipped`, `cancelled`) is no check.
 */

import type { HttpClient } from '@pkgs/http-client';
import type { Measurement } from '@pkgs/openslo/evaluate';

export const HEALTH_WORKFLOW_FILE = 'health.yml';
const PER_PAGE = 100;
/** Runs start before their jobs finish: look this far before the window. */
const RUN_LEAD_MS = 86_400_000;
const NOT_A_CHECK: ReadonlySet<string> = new Set(['skipped', 'cancelled']);

export type GitHubSource = {
  readonly http: HttpClient;
  /** `https://api.github.com` (Actions: `GITHUB_API_URL`). */
  readonly apiUrl: string;
  /** `owner/repo` (Actions: `GITHUB_REPOSITORY`). */
  readonly repository: string;
  readonly token: string;
};

export type HealthChecksQuery = {
  /** The environment whose `health:<env>` jobs count. */
  readonly env: string;
  /** Inclusive window, as the objective's measure receives it. */
  readonly startMs: number;
  readonly endMs: number;
};

type Run = { readonly id: number };
type Job = {
  readonly name: string;
  readonly status: string;
  readonly conclusion: string | null;
  readonly completed_at: string | null;
};
type RunsPage = {
  readonly total_count: number;
  readonly workflow_runs: readonly Run[];
};
type JobsPage = { readonly total_count: number; readonly jobs: readonly Job[] };

async function getJson<T>(source: GitHubSource, path: string): Promise<T> {
  const response = await source.http.fetch(`${source.apiUrl}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${source.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'gamezilla-health-objectives',
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub ${path} answered ${String(response.status)}`);
  }
  return (await response.json()) as T;
}

/** Every item of a paged listing, page after page until the count is reached. */
async function allPages<P, T>(input: {
  readonly fetchPage: (page: number) => Promise<P>;
  readonly items: (page: P) => readonly T[];
  readonly total: (page: P) => number;
}): Promise<readonly T[]> {
  const out: T[] = [];
  for (let page = 1; ; page += 1) {
    const found = await input.fetchPage(page);
    const items = input.items(found);
    out.push(...items);
    if (items.length < PER_PAGE || out.length >= input.total(found)) return out;
  }
}

function healthRuns(
  source: GitHubSource,
  sinceMs: number
): Promise<readonly Run[]> {
  const created = encodeURIComponent(`>=${new Date(sinceMs).toISOString()}`);
  const base = `/repos/${source.repository}/actions/workflows/${HEALTH_WORKFLOW_FILE}/runs?created=${created}&per_page=${String(PER_PAGE)}`;
  return allPages<RunsPage, Run>({
    fetchPage: (page) => getJson(source, `${base}&page=${String(page)}`),
    items: (page) => page.workflow_runs,
    total: (page) => page.total_count,
  });
}

function runJobs(source: GitHubSource, run: Run): Promise<readonly Job[]> {
  const base = `/repos/${source.repository}/actions/runs/${String(run.id)}/jobs?filter=all&per_page=${String(PER_PAGE)}`;
  return allPages<JobsPage, Job>({
    fetchPage: (page) => getJson(source, `${base}&page=${String(page)}`),
    items: (page) => page.jobs,
    total: (page) => page.total_count,
  });
}

/** A finished check of `env` inside the window, as an event; else nothing. */
export function jobEvent(
  job: Job,
  query: HealthChecksQuery
): { readonly atMs: number; readonly good: boolean } | null {
  if (job.name !== `health:${query.env}`) return null;
  if (job.status !== 'completed' || job.completed_at === null) return null;
  if (NOT_A_CHECK.has(job.conclusion ?? '')) return null;
  const atMs = Date.parse(job.completed_at);
  if (!(atMs >= query.startMs && atMs <= query.endMs)) return null;
  return { atMs, good: job.conclusion === 'success' };
}

/** Every finished `health:<env>` job in the window, oldest first. */
export async function healthCheckEvents(
  source: GitHubSource,
  query: HealthChecksQuery
): Promise<Measurement> {
  const runs = await healthRuns(source, query.startMs - RUN_LEAD_MS);
  const events = [];
  for (const run of runs) {
    for (const job of await runJobs(source, run)) {
      const event = jobEvent(job, query);
      if (event !== null) events.push(event);
    }
  }
  events.sort((a, b) => a.atMs - b.atMs);
  return { kind: 'events', events };
}
