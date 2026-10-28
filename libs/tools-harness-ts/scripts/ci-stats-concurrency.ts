/**
 * How many jobs ran, or wanted to run, at once: a sweep over job start and
 * end edges. Pure over records; `ci-stats-build.ts` feeds it.
 */
import { type JobRecord, secondsBetween } from './ci-stats-history';

const MS_PER_SECOND = 1000;

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export type ConcurrencyStats = {
  readonly peak: number;
  readonly peakAt: string;
  readonly peakByWorkflow: Readonly<Record<string, number>>;
  readonly busySeconds: number;
  readonly levelP50: number;
  readonly levelP90: number;
  readonly levelP99: number;
  readonly overlapSeconds: Readonly<Record<string, number>>;
};

export type Edge = {
  readonly at: number;
  readonly delta: 1 | -1;
  readonly workflow: string;
};

type Interval = {
  readonly workflow: string;
  readonly from: string | null;
  readonly to: string | null;
};

/** One edge pair per job that really ran: from `from` to `to`. */
export function intervalEdges(intervals: readonly Interval[]): Edge[] {
  const edges: Edge[] = [];
  for (const interval of intervals) {
    if (secondsBetween(interval.from, interval.to) === undefined) continue;
    const { workflow } = interval;
    edges.push({ at: Date.parse(interval.from ?? ''), delta: 1, workflow });
    edges.push({ at: Date.parse(interval.to ?? ''), delta: -1, workflow });
  }
  // Ends first at a tie, so back-to-back jobs do not count as overlapping.
  return edges.sort((a, b) => a.at - b.at || a.delta - b.delta);
}

/** Jobs on a runner: from the moment a runner took them until they finished. */
export function runningEdges(jobs: readonly JobRecord[]): Edge[] {
  return intervalEdges(
    jobs.map((job) => ({
      workflow: job.workflow,
      from: job.startedAt,
      to: job.completedAt,
    }))
  );
}

/** Jobs wanting a runner: queued time counts as well as running time. */
export function demandEdges(jobs: readonly JobRecord[]): Edge[] {
  return intervalEdges(
    jobs.map((job) => ({
      workflow: job.workflow,
      from: job.createdAt,
      to: job.completedAt,
    }))
  );
}

type Sweep = {
  at: number;
  level: number;
  byWorkflow: Map<string, number>;
  levelMs: Map<number, number>;
  overlapMs: Map<string, number>;
  peak: number;
  peakAt: number;
  peakByWorkflow: Record<string, number>;
};

export function concurrencyStats(edges: readonly Edge[]): ConcurrencyStats {
  const first = edges[0];
  const sweep: Sweep = {
    at: first?.at ?? 0,
    level: 0,
    byWorkflow: new Map(),
    levelMs: new Map(),
    overlapMs: new Map(),
    peak: 0,
    peakAt: first?.at ?? 0,
    peakByWorkflow: {},
  };
  for (const edge of edges) {
    advance(sweep, edge.at);
    apply(sweep, edge);
  }
  return summarize(sweep);
}

function advance(sweep: Sweep, to: number): void {
  const span = to - sweep.at;
  sweep.at = to;
  if (span <= 0 || sweep.level === 0) return;
  sweep.levelMs.set(sweep.level, (sweep.levelMs.get(sweep.level) ?? 0) + span);
  const active = [...sweep.byWorkflow]
    .filter(([, count]) => count > 0)
    .map(([name]) => name)
    .sort();
  for (let i = 0; i < active.length; i++)
    for (let j = i + 1; j < active.length; j++) {
      const key = `${active[i]} + ${active[j]}`;
      sweep.overlapMs.set(key, (sweep.overlapMs.get(key) ?? 0) + span);
    }
}

function apply(sweep: Sweep, edge: Edge): void {
  sweep.level += edge.delta;
  sweep.byWorkflow.set(
    edge.workflow,
    (sweep.byWorkflow.get(edge.workflow) ?? 0) + edge.delta
  );
  if (sweep.level <= sweep.peak) return;
  sweep.peak = sweep.level;
  sweep.peakAt = edge.at;
  sweep.peakByWorkflow = Object.fromEntries(
    [...sweep.byWorkflow].filter(([, count]) => count > 0)
  );
}

function summarize(sweep: Sweep): ConcurrencyStats {
  const busyMs = [...sweep.levelMs.values()].reduce((sum, ms) => sum + ms, 0);
  return {
    peak: sweep.peak,
    peakAt: sweep.peak ? new Date(sweep.peakAt).toISOString() : '',
    peakByWorkflow: sweep.peakByWorkflow,
    busySeconds: round(busyMs / MS_PER_SECOND),
    levelP50: weightedLevel(sweep.levelMs, 0.5),
    levelP90: weightedLevel(sweep.levelMs, 0.9),
    levelP99: weightedLevel(sweep.levelMs, 0.99),
    overlapSeconds: Object.fromEntries(
      [...sweep.overlapMs].map(([key, ms]) => [key, round(ms / MS_PER_SECOND)])
    ),
  };
}

/** The level that busy time stays at or under for `p` of its duration. */
function weightedLevel(
  levelMs: ReadonlyMap<number, number>,
  p: number
): number {
  const levels = [...levelMs].sort((a, b) => a[0] - b[0]);
  const total = levels.reduce((sum, [, ms]) => sum + ms, 0);
  let seen = 0;
  for (const [level, ms] of levels) {
    seen += ms;
    if (seen >= total * p) return level;
  }
  return 0;
}
