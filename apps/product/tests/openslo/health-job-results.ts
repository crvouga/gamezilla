/** Every finished native Health check of one environment, including reruns. */
import type { HttpClient } from '@pkgs/http-client-shared/types';
import type { Measurement } from '@pkgs/openslo-shared/evaluate';

export const HEALTH_WORKFLOW_FILE = 'health.yml';
const RUN_LEAD_MS = 86_400_000;

export type DepotSource = {
  readonly http: HttpClient;
  readonly apiUrl: string;
  readonly repository: string;
  readonly orgId: string;
  readonly token: string;
};
export type HealthChecksQuery = {
  readonly env: string;
  readonly startMs: number;
  readonly endMs: number;
};

/** The automatic DEPOT_TOKEN can only access the current job attempt. */
export function healthHistoryToken(
  vars: Readonly<Record<string, string | undefined>>
): string {
  const token = vars['DEPOT_ORG_TOKEN']?.trim() ?? '';
  if (token.length === 0) {
    throw new Error(
      'DEPOT_ORG_TOKEN is missing — seed a Depot organization API token in the shared secrets environment; the automatic DEPOT_TOKEN cannot read Health history'
    );
  }
  return token;
}
type Run = { readonly runId: string; readonly createdAt: string };
type RunsPage = {
  readonly runs: readonly Run[];
  readonly nextPageToken?: string;
};
type Attempt = {
  readonly status: string;
  readonly finishedAt: string;
};
type Job = {
  readonly jobDisplayName: string;
  readonly attempts?: readonly Attempt[];
};
type Workflow = {
  readonly workflowId: string;
  readonly workflowPath: string;
  readonly name: string;
};

async function rpc<T>(
  source: DepotSource,
  method: string,
  body: Readonly<Record<string, unknown>>
): Promise<T> {
  const response = await source.http.fetch(
    `${source.apiUrl}/depot.ci.v1.CIService/${method}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${source.token}`,
        'Content-Type': 'application/json',
        'Connect-Protocol-Version': '1',
        'X-Depot-Org': source.orgId,
      },
      body: JSON.stringify(body),
    }
  );
  if (!response.ok) {
    throw new Error(`Depot ${method} answered ${String(response.status)}`);
  }
  return (await response.json()) as T;
}

async function healthRuns(
  source: DepotSource,
  sinceMs: number
): Promise<readonly Run[]> {
  const runs: Run[] = [];
  let pageToken = '';
  do {
    const page = await rpc<RunsPage>(source, 'ListRuns', {
      repo: source.repository,
      status: ['queued', 'running', 'finished', 'failed', 'cancelled'],
      pageSize: 100,
      pageToken,
    });
    runs.push(
      ...page.runs.filter((run) => Date.parse(run.createdAt) >= sinceMs)
    );
    if (page.runs.some((run) => Date.parse(run.createdAt) < sinceMs)) break;
    pageToken = page.nextPageToken ?? '';
  } while (pageToken !== '');
  return runs;
}

async function runJobs(source: DepotSource, run: Run): Promise<readonly Job[]> {
  const status = await rpc<{ readonly workflows?: readonly Workflow[] }>(
    source,
    'GetRunStatus',
    { runId: run.runId }
  );
  const jobs: Job[] = [];
  for (const workflow of status.workflows ?? []) {
    if (
      workflow.workflowPath.split('/').at(-1) !== HEALTH_WORKFLOW_FILE &&
      workflow.name !== 'Health'
    )
      continue;
    const detail = await rpc<{ readonly jobs?: readonly Job[] }>(
      source,
      'GetWorkflow',
      { workflowId: workflow.workflowId }
    );
    jobs.push(...(detail.jobs ?? []));
  }
  return jobs;
}

/** A completed attempt inside the inclusive window; cancelled attempts do not count. */
export function jobEvent(
  attempt: Attempt,
  query: HealthChecksQuery
): { readonly atMs: number; readonly good: boolean } | null {
  if (!['finished', 'failed'].includes(attempt.status)) return null;
  const atMs = Date.parse(attempt.finishedAt);
  if (!(atMs >= query.startMs && atMs <= query.endMs)) return null;
  return { atMs, good: attempt.status === 'finished' };
}

export async function healthCheckEvents(
  source: DepotSource,
  query: HealthChecksQuery
): Promise<Measurement> {
  const runs = await healthRuns(source, query.startMs - RUN_LEAD_MS);
  const events = [];
  for (const run of runs) {
    for (const job of await runJobs(source, run)) {
      if (job.jobDisplayName !== `health:${query.env}`) continue;
      for (const attempt of job.attempts ?? []) {
        const event = jobEvent(attempt, query);
        if (event !== null) events.push(event);
      }
    }
  }
  events.sort((a, b) => a.atMs - b.atMs);
  return { kind: 'events', events };
}
