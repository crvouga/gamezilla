// @io-wall-ok — GitHub check and producer metadata adapter.
import { spawnSync } from 'node:child_process';
import type { PrCheckSnapshot } from './pr-check-readiness';
import { isPullRequestCheck, type PrCheck } from './required-pr-checks';

type CheckRun = {
  readonly name: string;
  readonly status: string;
  readonly conclusion: string | null;
  readonly app: { readonly id: number };
  readonly details_url: string;
};
type CommitStatus = { readonly context: string; readonly state: string };

function pages<T>(endpoint: string): readonly T[] {
  const result = spawnSync('gh', ['api', '--paginate', '--slurp', endpoint], {
    encoding: 'utf8',
    timeout: 15_000,
  });
  if (result.status !== 0)
    throw new Error(`Cannot inspect mandatory PR checks: ${result.stderr}`);
  return JSON.parse(result.stdout) as readonly T[];
}

/** A workflow run's event never changes, so each run is looked up once per process. */
export function memoizedWorkflowEvents(
  lookup: (runId: string) => string
): (runId: string) => string {
  const events = new Map<string, string>();
  return (runId) => {
    let event = events.get(runId);
    if (event === undefined) {
      event = lookup(runId);
      events.set(runId, event);
    }
    return event;
  };
}

const workflowEvents = new Map<string, (runId: string) => string>();

function workflowEventsFor(repository: string): (runId: string) => string {
  let events = workflowEvents.get(repository);
  if (events === undefined) {
    events = memoizedWorkflowEvents((runId) => {
      const result = spawnSync(
        'gh',
        ['api', `repos/${repository}/actions/runs/${runId}`, '--jq', '.event'],
        { encoding: 'utf8', timeout: 15_000 }
      );
      if (result.status !== 0)
        throw new Error(`Cannot identify PR check source: ${result.stderr}`);
      return result.stdout.trim();
    });
    workflowEvents.set(repository, events);
  }
  return events;
}

function pullRequestChecks(
  repository: string,
  checks: readonly CheckRun[]
): readonly CheckRun[] {
  const eventOf = workflowEventsFor(repository);
  return checks.filter((check) => {
    if (check.app.id !== 15368) return true;
    const id = check.details_url.match(/\/actions\/runs\/(\d+)(?:\/|$)/)?.[1];
    if (id === undefined)
      throw new Error(`Cannot identify the workflow for ${check.name}`);
    return isPullRequestCheck(check.app.id, eventOf(id));
  });
}

function checksFor(repository: string, sha: string): readonly PrCheck[] {
  const base = `repos/${repository}/commits/${sha}`;
  const runs = pages<{ readonly check_runs: readonly CheckRun[] }>(
    `${base}/check-runs?filter=latest&per_page=100`
  ).flatMap((page) => page.check_runs);
  const checks = pullRequestChecks(repository, runs).map((check) => ({
    sha,
    name: check.name,
    appId: check.app.id,
    status: check.status,
    conclusion: check.conclusion,
  }));
  // The status API is newest first; an older status must not override its replacement.
  const statuses = new Map<string, PrCheck>();
  for (const page of pages<readonly CommitStatus[]>(
    `${base}/statuses?per_page=100`
  ))
    for (const status of page)
      if (!statuses.has(status.context))
        statuses.set(status.context, {
          sha,
          name: status.context,
          appId: 0,
          status: status.state === 'pending' ? 'in_progress' : 'completed',
          conclusion: status.state === 'success' ? 'success' : status.state,
        });
  return [...checks, ...statuses.values()];
}

type WorkflowRun = {
  readonly head_sha: string;
  readonly event: string;
  readonly path: string;
  readonly status: string;
};

export function isActiveCodeqlProducer(run: WorkflowRun, sha: string): boolean {
  return (
    run.head_sha === sha &&
    run.event === 'dynamic' &&
    run.path === 'dynamic/github-code-scanning/codeql' &&
    ['queued', 'in_progress', 'waiting', 'pending', 'requested'].includes(
      run.status
    )
  );
}

export function readPrCheckSnapshot(
  repository: string,
  shas: readonly string[]
): PrCheckSnapshot {
  const activeCodeqlShas = shas.filter((sha) =>
    pages<{ readonly workflow_runs: readonly WorkflowRun[] }>(
      `repos/${repository}/actions/runs?head_sha=${sha}&per_page=100`
    ).some((page) =>
      page.workflow_runs.some((run) => isActiveCodeqlProducer(run, sha))
    )
  );
  return {
    activeCodeqlShas,
    checks: shas.flatMap((sha) => checksFor(repository, sha)),
  };
}
