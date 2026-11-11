/**
 * `bun alerts`: what Health says needs attention now, read with nothing but
 * `gh`. The newest completed Health run on `main` whose `health:objectives`
 * job left its work items in the log (`HEALTH_ALERTS_V1`, written by
 * `scripts/health-alerts.ts`); a newer run without them (it yielded to a
 * deploy, was cancelled, or its evidence step never ran) is walked past and
 * named. Beside the work items: the run's failing check jobs
 * (`health:<env>` journeys and probes) with their failing scenarios.
 */

import type { WorkItem, WorkItemsDocument } from './alert-work-items';
import { decodeLogBlock, renderWorkItems } from './alert-work-items-render';

/** Runs `gh <args>` and returns its stdout; throws when gh fails. */
export type GhPort = (args: readonly string[]) => string;

export type HealthRun = {
  readonly databaseId: number;
  readonly createdAt: string;
  readonly url: string;
  readonly headSha: string;
  readonly conclusion: string;
  readonly event: string;
};

type HealthJob = {
  readonly databaseId: number;
  readonly name: string;
  readonly conclusion: string;
  readonly url: string;
};

export type FailingCheck = {
  readonly job: string;
  readonly environment: string | null;
  readonly conclusion: string;
  readonly url: string;
  readonly scenarios: readonly string[];
};

export type OpenAlerts = {
  readonly run: HealthRun;
  readonly ageMs: number;
  /** Newer runs walked past, and why. */
  readonly skipped: readonly {
    readonly run: HealthRun;
    readonly why: string;
  }[];
  readonly document: WorkItemsDocument;
  readonly failingChecks: readonly FailingCheck[];
};

export const OBJECTIVES_JOB = 'health:objectives';
/** How far back to look for a run with work items. */
export const RUNS_SEARCHED = 20;
const FAILED = new Set(['failure', 'timed_out', 'startup_failure']);

export function listHealthRuns(gh: GhPort): readonly HealthRun[] {
  const runs = JSON.parse(
    gh([
      'run',
      'list',
      '--workflow',
      'health.yml',
      '--branch',
      'main',
      '--status',
      'completed',
      '--limit',
      String(RUNS_SEARCHED),
      '--json',
      'databaseId,createdAt,url,headSha,conclusion,event',
    ])
  ) as HealthRun[];
  return [...runs].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
  );
}

function jobsOf(gh: GhPort, run: HealthRun): readonly HealthJob[] {
  const parsed = JSON.parse(
    gh(['run', 'view', String(run.databaseId), '--json', 'jobs'])
  ) as { readonly jobs?: readonly HealthJob[] };
  return parsed.jobs ?? [];
}

/** Scenario names bun reported failing (`(fail) <file> > <scenario> [12ms]`). */
export function failingScenarios(log: string): readonly string[] {
  const names = new Set<string>();
  for (const line of log.split('\n')) {
    const match = /\(fail\) (.+?)(?: \[[\d.]+m?s\])?\s*$/.exec(line);
    if (match?.[1] !== undefined) names.add(match[1]);
  }
  return [...names];
}

function failingChecks(
  gh: GhPort,
  jobs: readonly HealthJob[],
  document: WorkItemsDocument
): readonly FailingCheck[] {
  return jobs
    .filter(
      (job) =>
        FAILED.has(job.conclusion) &&
        (job.name !== OBJECTIVES_JOB || document.items.length === 0)
    )
    .map((job) => {
      const env = job.name.startsWith('health:')
        ? job.name.slice('health:'.length)
        : '';
      let log = '';
      try {
        log = gh([
          'run',
          'view',
          '--job',
          String(job.databaseId),
          '--log-failed',
        ]);
      } catch {
        // The job's log expired or never existed; its name and link remain.
      }
      return {
        job: job.name,
        environment: document.environments.includes(env) ? env : null,
        conclusion: job.conclusion,
        url: job.url,
        scenarios: failingScenarios(log),
      };
    });
}

/** Why a run has no work items, or its document and jobs. */
function readRun(
  gh: GhPort,
  run: HealthRun
):
  | { readonly why: string }
  | {
      readonly document: WorkItemsDocument;
      readonly jobs: readonly HealthJob[];
    } {
  const jobs = jobsOf(gh, run);
  const objectives = jobs.find((job) => job.name === OBJECTIVES_JOB);
  if (
    objectives === undefined ||
    (objectives.conclusion !== 'success' && objectives.conclusion !== 'failure')
  ) {
    return {
      why: `its ${OBJECTIVES_JOB} job ${objectives === undefined ? 'did not run' : `ended ${objectives.conclusion || 'without a result'}`} (it yielded to a deploy or was cancelled)`,
    };
  }
  let log = '';
  try {
    log = gh(['run', 'view', '--job', String(objectives.databaseId), '--log']);
  } catch {
    return { why: `the ${OBJECTIVES_JOB} log could not be read` };
  }
  const document = decodeLogBlock(log);
  if (document === null)
    return { why: `its ${OBJECTIVES_JOB} log holds no work items` };
  return { document, jobs };
}

export function findOpenAlerts(
  gh: GhPort,
  nowMs: number
): OpenAlerts | { readonly error: string } {
  const skipped: { run: HealthRun; why: string }[] = [];
  for (const run of listHealthRuns(gh)) {
    const read = readRun(gh, run);
    if ('why' in read) {
      skipped.push({ run, why: read.why });
      continue;
    }
    return {
      run,
      ageMs: nowMs - Date.parse(run.createdAt),
      skipped,
      document: read.document,
      failingChecks: failingChecks(gh, read.jobs, read.document),
    };
  }
  return {
    error: `none of the last ${String(RUNS_SEARCHED)} completed Health runs on main left work items (${String(skipped.length)} looked at); dispatch one with: gh workflow run health.yml --ref main`,
  };
}

export function forEnvironment(
  alerts: OpenAlerts,
  env: string | undefined
): OpenAlerts {
  if (env === undefined) return alerts;
  const items: readonly WorkItem[] = alerts.document.items.filter(
    (item) => item.environment === env
  );
  return {
    ...alerts,
    document: { ...alerts.document, items },
    failingChecks: alerts.failingChecks.filter(
      (check) => check.environment === env
    ),
  };
}

export function formatAge(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  if (days > 0) return `${String(days)}d ${String(hours)}h`;
  if (hours > 0) return `${String(hours)}h ${String(rest)}m`;
  return `${String(rest)}m`;
}

export function renderOpenAlerts(alerts: OpenAlerts): string {
  const { run } = alerts;
  const lines = [
    `Health run ${String(run.databaseId)} on main @${run.headSha.slice(0, 7)}, ${formatAge(alerts.ageMs)} ago (${run.conclusion}): ${run.url}`,
    ...alerts.skipped.map(
      (s) =>
        `Walked past newer run ${String(s.run.databaseId)} (${s.run.createdAt}): ${s.why}`
    ),
    '',
    renderWorkItems(alerts.document),
    `## Failing Health checks (${String(alerts.failingChecks.length)})`,
    '',
  ];
  if (alerts.failingChecks.length === 0) lines.push('Every check job passed.');
  for (const check of alerts.failingChecks) {
    lines.push(`- ${check.job} (${check.conclusion}): ${check.url}`);
    for (const scenario of check.scenarios) lines.push(`  - ${scenario}`);
  }
  return `${lines.join('\n')}\n`;
}

export function openAlertsJson(alerts: OpenAlerts): string {
  return `${JSON.stringify(
    {
      run: alerts.run,
      ageMs: alerts.ageMs,
      skipped: alerts.skipped,
      environments: alerts.document.environments,
      generatedAt: alerts.document.generatedAt,
      items: alerts.document.items,
      failingChecks: alerts.failingChecks,
    },
    null,
    2
  )}\n`;
}
