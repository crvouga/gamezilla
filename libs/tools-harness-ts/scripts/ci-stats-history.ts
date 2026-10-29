/**
 * What GitHub Actions history says about CI load, as pure functions over run
 * and job records. `ci-stats.ts` fetches the records and `ci-stats-render.ts`
 * prints these results.
 *
 * Observed concurrency is capped by the runners that existed while a run
 * executed, and a Verify plan never starts more shards than the online
 * runners. So the numbers that carry to a bigger or smaller pool are
 * agent-seconds (the sum of job durations) and the per-job durations, not
 * the observed peak.
 */
import { percentile } from './ci-load';

export type StepRecord = {
  readonly name: string;
  readonly conclusion: string | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
};

export type RunRecord = {
  readonly workflow: string;
  readonly id: number;
  readonly event: string;
  readonly conclusion: string | null;
  readonly createdAt: string;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly headBranch: string;
};

export type JobRecord = {
  readonly workflow: string;
  readonly runId: number;
  readonly name: string;
  readonly conclusion: string | null;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly runnerName: string | null;
  readonly steps: readonly StepRecord[];
};

export type Distribution = {
  readonly count: number;
  readonly p50: number;
  readonly p90: number;
  readonly p99: number;
  readonly max: number;
  readonly total: number;
};

export type FamilyStats = {
  readonly workflow: string;
  readonly family: string;
  readonly kind: RunnerKind;
  readonly jobs: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly cancelled: number;
  readonly duration: Distribution;
  readonly queueWait: Distribution;
};

export type WorkflowStats = {
  readonly workflow: string;
  readonly runs: number;
  readonly executedRuns: number;
  readonly runsPerDay: number;
  readonly events: Readonly<Record<string, number>>;
  readonly conclusions: Readonly<Record<string, number>>;
  readonly wallClock: Distribution;
  readonly passingWallClock: Distribution;
  readonly jobsPerRun: Distribution;
  readonly shardsPerRun: Distribution;
  readonly agentSecondsPerRun: Distribution;
  readonly agentHoursPerDay: number;
};

export type StepStats = {
  readonly family: string;
  readonly kind: RunnerKind;
  readonly step: string;
  readonly duration: Distribution;
};

export type RunnerUse = {
  readonly runner: string;
  readonly jobs: number;
  readonly busySeconds: number;
};

const MS_PER_SECOND = 1000;
export const SHARD_FAMILY = 'verify:shards';
const FINISHED = new Set(['success', 'failure']);

export function distribution(values: readonly number[]): Distribution {
  const finite = values.filter((value) => Number.isFinite(value));
  return {
    count: finite.length,
    p50: round(percentile(finite, 0.5)),
    p90: round(percentile(finite, 0.9)),
    p99: round(percentile(finite, 0.99)),
    max: round(finite.length ? Math.max(...finite) : 0),
    total: round(finite.reduce((sum, value) => sum + value, 0)),
  };
}

export function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Seconds from one timestamp to another, or `undefined` when either is bad. */
export function secondsBetween(
  from: string | null,
  to: string | null
): number | undefined {
  if (from === null || to === null) return undefined;
  const span = (Date.parse(to) - Date.parse(from)) / MS_PER_SECOND;
  return Number.isFinite(span) && span >= 0 ? span : undefined;
}

/**
 * The job's family: the caller's prefix (`deploy-verify / `) and the matrix
 * index (` (12)`) come off, so every shard of every workflow is one family.
 */
export function jobFamily(name: string): string {
  const slash = name.lastIndexOf(' / ');
  const own = slash < 0 ? name : name.slice(slash + 3);
  return own.replace(/ \(\d+\)$/, '');
}

function counts(values: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const value of values) out[value] = (out[value] ?? 0) + 1;
  return out;
}

function groupBy<T>(
  items: readonly T[],
  key: (item: T) => string
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const name = key(item);
    const group = groups.get(name);
    if (group) group.push(item);
    else groups.set(name, [item]);
  }
  return groups;
}

function jobDuration(job: JobRecord): number | undefined {
  return secondsBetween(job.startedAt, job.completedAt);
}

export function familyStats(jobs: readonly JobRecord[]): FamilyStats[] {
  const groups = groupBy(
    jobs,
    (job) =>
      `${job.workflow}\u0000${jobFamily(job.name)}\u0000${runnerKind(job)}`
  );
  return [...groups.values()]
    .map((group) => oneFamily(group))
    .sort((a, b) => b.duration.total - a.duration.total);
}

function oneFamily(group: readonly JobRecord[]): FamilyStats {
  const first = group[0];
  if (!first) throw new Error('empty job family');
  const passed = group.filter((job) => job.conclusion === 'success');
  return {
    workflow: first.workflow,
    family: jobFamily(first.name),
    kind: runnerKind(first),
    jobs: group.length,
    succeeded: passed.length,
    failed: group.filter((job) => job.conclusion === 'failure').length,
    cancelled: group.filter((job) => job.conclusion === 'cancelled').length,
    duration: distribution(
      passed.map(jobDuration).filter((value) => value !== undefined)
    ),
    queueWait: distribution(
      group
        .map((job) => secondsBetween(job.createdAt, job.startedAt))
        .filter((value) => value !== undefined)
    ),
  };
}

/**
 * Per workflow over one shared window. `jobs` are the jobs a runner took, so
 * a run with none of them never executed and stays out of every per-run
 * measure but the run count.
 */
export function workflowStats(
  runs: readonly RunRecord[],
  jobs: readonly JobRecord[],
  days: number
): WorkflowStats[] {
  const jobsByRun = groupBy(jobs, (job) => String(job.runId));
  return [...groupBy(runs, (run) => run.workflow).values()].map((group) =>
    oneWorkflow(group, jobsByRun, days)
  );
}

function oneWorkflow(
  runs: readonly RunRecord[],
  jobsByRun: ReadonlyMap<string, readonly JobRecord[]>,
  days: number
): WorkflowStats {
  const first = runs[0];
  if (!first) throw new Error('empty workflow');
  const executed = runs.filter((run) => jobsByRun.has(String(run.id)));
  const withJobs = executed.map((run) => jobsByRun.get(String(run.id)) ?? []);
  const agentSeconds = withJobs.map((list) =>
    list.reduce((sum, job) => sum + (jobDuration(job) ?? 0), 0)
  );
  return {
    workflow: first.workflow,
    runs: runs.length,
    executedRuns: executed.length,
    runsPerDay: round(runs.length / days),
    events: counts(runs.map((run) => run.event)),
    conclusions: counts(runs.map((run) => run.conclusion ?? 'unfinished')),
    wallClock: wallClock(executed, FINISHED),
    passingWallClock: wallClock(executed, new Set(['success'])),
    jobsPerRun: distribution(withJobs.map((list) => list.length)),
    shardsPerRun: distribution(
      withJobs.map(
        (list) =>
          list.filter((job) => jobFamily(job.name) === SHARD_FAMILY).length
      )
    ),
    agentSecondsPerRun: distribution(agentSeconds),
    agentHoursPerDay: round(
      agentSeconds.reduce((sum, value) => sum + value, 0) / 3600 / days
    ),
  };
}

function wallClock(
  runs: readonly RunRecord[],
  conclusions: ReadonlySet<string>
): Distribution {
  return distribution(
    runs
      .filter((run) => conclusions.has(run.conclusion ?? ''))
      .map((run) => secondsBetween(run.startedAt, run.updatedAt))
      .filter((value) => value !== undefined)
  );
}

/** Run starts by UTC hour of day, one row per trigger event. */
export function arrivalsByHour(
  runs: readonly RunRecord[]
): Record<string, number[]> {
  const rows: Record<string, number[]> = {};
  for (const run of runs) {
    const row = rows[run.event] ?? new Array<number>(24).fill(0);
    const hour = new Date(Date.parse(run.createdAt)).getUTCHours();
    row[hour] = (row[hour] ?? 0) + 1;
    rows[run.event] = row;
  }
  return rows;
}

/** Self-hosted runners by name, GitHub-hosted ones as a single row. */
export function runnerUsage(jobs: readonly JobRecord[]): RunnerUse[] {
  const groups = groupBy(
    jobs.filter((job) => runnerKind(job) !== 'none'),
    (job) =>
      runnerKind(job) === 'github-hosted'
        ? 'GitHub-hosted (all)'
        : (job.runnerName ?? '')
  );
  return [...groups]
    .map(([runner, list]) => ({
      runner,
      jobs: list.length,
      busySeconds: round(
        list.reduce((sum, job) => sum + (jobDuration(job) ?? 0), 0)
      ),
    }))
    .sort((a, b) => b.busySeconds - a.busySeconds);
}

/**
 * How long each step of the named job families takes on a successful job:
 * the split between setup (checkout, install) and the work itself.
 */
export function stepStats(
  jobs: readonly JobRecord[],
  families: readonly string[]
): StepStats[] {
  const out: StepStats[] = [];
  for (const family of families)
    for (const kind of ['self-hosted', 'github-hosted'] as const) {
      const own = jobs.filter(
        (job) =>
          jobFamily(job.name) === family &&
          runnerKind(job) === kind &&
          job.conclusion === 'success'
      );
      const byStep = groupBy(
        own.flatMap((job) => job.steps),
        (step) => step.name
      );
      for (const [step, list] of byStep)
        out.push({ family, kind, step, duration: stepDuration(list) });
    }
  return out
    .filter((row) => row.duration.p50 >= 1)
    .sort((a, b) => b.duration.p50 - a.duration.p50);
}

function stepDuration(list: readonly StepRecord[]): Distribution {
  return distribution(
    list
      .filter((entry) => entry.conclusion === 'success')
      .map((entry) => secondsBetween(entry.startedAt, entry.completedAt))
      .filter((value) => value !== undefined)
  );
}

export type RunnerKind = 'self-hosted' | 'github-hosted' | 'none';

export type Placement = {
  readonly kind: RunnerKind;
  readonly jobs: number;
  readonly agentHours: number;
  /** First job created and last job completed on this kind, or empty. */
  readonly firstAt: string;
  readonly lastAt: string;
  readonly wait: Distribution;
};

/** Where a job ran: a self-hosted agent, a GitHub-hosted VM, or nowhere. */
export function runnerKind(job: JobRecord): RunnerKind {
  if (job.runnerName === null || job.runnerName === '') return 'none';
  return /^(GitHub Actions \d+|GitHub-hosted|Hosted Agent)/.test(job.runnerName)
    ? 'github-hosted'
    : 'self-hosted';
}

/**
 * Per kind: jobs, agent-hours, and the wait. A job that ran waited from
 * creation to start; one that never got a runner waited from creation to the
 * moment it was cancelled or skipped.
 */
export function placement(jobs: readonly JobRecord[]): Placement[] {
  const kinds: RunnerKind[] = ['self-hosted', 'github-hosted', 'none'];
  return kinds.map((kind) => {
    const own = jobs.filter((job) => runnerKind(job) === kind);
    const waits =
      kind === 'none'
        ? own
            .filter((job) => job.conclusion === 'cancelled')
            .map((job) => secondsBetween(job.createdAt, job.completedAt))
        : own.map((job) => secondsBetween(job.createdAt, job.startedAt));
    // A job that never got a runner has a placeholder start, not agent time.
    const agentSeconds =
      kind === 'none'
        ? 0
        : own.reduce((sum, job) => sum + (jobDuration(job) ?? 0), 0);
    return {
      kind,
      jobs: own.length,
      agentHours: round(agentSeconds / 3600),
      ...extent(own),
      wait: distribution(waits.filter((value) => value !== undefined)),
    };
  });
}

function extent(jobs: readonly JobRecord[]): {
  firstAt: string;
  lastAt: string;
} {
  const starts = jobs.map((job) => Date.parse(job.createdAt));
  const ends = jobs
    .map((job) => Date.parse(job.completedAt ?? ''))
    .filter((value) => Number.isFinite(value));
  if (starts.length === 0 || ends.length === 0)
    return { firstAt: '', lastAt: '' };
  return {
    firstAt: new Date(Math.min(...starts)).toISOString(),
    lastAt: new Date(Math.max(...ends)).toISOString(),
  };
}
