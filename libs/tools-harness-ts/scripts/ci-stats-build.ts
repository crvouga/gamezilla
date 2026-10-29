/**
 * Joins the run and job records into the statistics `ci-stats-render.ts`
 * prints.
 */
import {
  type ConcurrencyStats,
  concurrencyStats,
  demandEdges,
  runningEdges,
} from './ci-stats-concurrency';
import {
  arrivalsByHour,
  type FamilyStats,
  familyStats,
  type JobRecord,
  type Placement,
  placement,
  type RunnerUse,
  type RunRecord,
  round,
  runnerKind,
  runnerUsage,
  SHARD_FAMILY,
  type StepStats,
  secondsBetween,
  stepStats,
  type WorkflowStats,
  workflowStats,
} from './ci-stats-history';

export type HistoryStats = {
  readonly from: string;
  readonly to: string;
  readonly days: number;
  readonly runs: number;
  readonly jobs: number;
  readonly placement: readonly Placement[];
  readonly workflows: readonly WorkflowStats[];
  readonly families: readonly FamilyStats[];
  /** Jobs running on self-hosted runners: capped by the fleet's size. */
  readonly running: ConcurrencyStats;
  /** Jobs running on GitHub-hosted VMs: the workflows' uncapped parallelism. */
  readonly runningHosted: ConcurrencyStats;
  /** Jobs running anywhere. */
  readonly runningAll: ConcurrencyStats;
  /** Jobs running or queued for a runner, anywhere. */
  readonly demand: ConcurrencyStats;
  readonly arrivals: Readonly<Record<string, readonly number[]>>;
  readonly runners: readonly RunnerUse[];
  readonly steps: readonly StepStats[];
};

export type Window = { readonly from: string; readonly to: string };

const SECONDS_PER_DAY = 86_400;
const MIN_WINDOW_SECONDS = 3600;
const STEP_FAMILIES = ['verify:start', SHARD_FAMILY, 'verify:end'];

/**
 * Per-run and per-job measures read every job that ran, self-hosted or
 * GitHub-hosted, and name the kind where hardware matters. Concurrency is
 * kept apart per kind: self-hosted is capped by the fleet, GitHub-hosted is
 * not. Demand also counts jobs that waited for a runner and were cancelled.
 */
export function buildHistory(
  runs: readonly RunRecord[],
  jobs: readonly JobRecord[],
  window: Window
): HistoryStats {
  const ran = jobs.filter((job) => runnerKind(job) !== 'none');
  const own = ran.filter((job) => runnerKind(job) === 'self-hosted');
  const hosted = ran.filter((job) => runnerKind(job) === 'github-hosted');
  const wanted = jobs.filter((job) => job.conclusion !== 'skipped');
  const seconds = secondsBetween(window.from, window.to) ?? 0;
  const days = Math.max(MIN_WINDOW_SECONDS, seconds) / SECONDS_PER_DAY;
  return {
    ...window,
    days: round(days),
    runs: runs.length,
    jobs: jobs.length,
    placement: placement(jobs),
    workflows: workflowStats(runs, ran, days),
    families: familyStats(ran),
    running: concurrencyStats(runningEdges(own)),
    runningHosted: concurrencyStats(runningEdges(hosted)),
    runningAll: concurrencyStats(runningEdges(ran)),
    demand: concurrencyStats(demandEdges(wanted)),
    arrivals: arrivalsByHour(runs),
    runners: runnerUsage(jobs),
    steps: stepStats(ran, STEP_FAMILIES),
  };
}
