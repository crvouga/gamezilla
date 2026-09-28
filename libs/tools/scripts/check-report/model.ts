/**
 * The `bun check` report as data: what each gate task did in one run, and how
 * the pieces of a sharded CI run fold back into one report.
 *
 * A run writes a {@link CheckFragment}: the plan's view of every task (its
 * turbo hash and whether a cache held it) overlaid with what turbo's run
 * summary says happened. Locally one `bun check:local` is one fragment; on CI the
 * `check:plan` job writes the plan's fragment and every `check:shard` its
 * own, and {@link mergeFragments} folds them into a {@link CheckReport}.
 *
 * The report's id is {@link gateFingerprint}: a hash over every task's turbo
 * hash, so the same inputs always name the same report, on any machine.
 */
import { createHash } from 'node:crypto';
import type { ScenarioRun } from '@libs/harness/scenario-report';

/**
 * - `passed` / `failed`: the task executed in this run.
 * - `cached`: a cache held a passing result for these exact inputs.
 * - `not-run`: planned, but no run reached it (a failure stopped turbo, a
 *   deadline killed it, or a shard never reported).
 */
export type TaskStatus = 'passed' | 'failed' | 'cached' | 'not-run';

export type ReportTask = {
  readonly taskId: string;
  readonly hash: string;
  readonly status: TaskStatus;
  /** Wall seconds when it executed; null for a cache hit or no run. */
  readonly seconds: number | null;
  /** Tail of the task's log when the report keeps it (failures, spec gates). */
  readonly log: string | null;
};

export type Scm = { readonly sha: string; readonly branch: string };

/**
 * One spec part's report bucket (`<pkg>/.cache/harness-report/part-<k>`)
 * this run ran or restored, labelled with its task id
 * (`@libs/friends#test:spec:0`).
 */
export type SpecRun = ScenarioRun;

export type CheckFragment = {
  /** `plan`: statuses from the cache plan only. `run`: a run's outcomes. */
  readonly source: 'plan' | 'run';
  readonly scm: Scm | null;
  readonly tasks: readonly ReportTask[];
  /** The run's exit status (budget overruns included); null for a plan. */
  readonly exitCode: number | null;
  readonly specRuns: readonly SpecRun[];
};

export type Verdict = 'passed' | 'failed' | 'incomplete';

export type CheckReport = {
  readonly id: string;
  readonly verdict: Verdict;
  readonly scm: Scm | null;
  readonly tasks: readonly ReportTask[];
  readonly specRuns: readonly SpecRun[];
  /** Where this report came from (a CI run URL), when known. */
  readonly origin: string | null;
};

/** One task of `turbo run --dry=json` / the run plan. */
export type PlanTask = {
  readonly taskId: string;
  readonly hash: string;
  readonly hit: boolean;
};

/** One task of a turbo `--summarize` run summary. */
export type SummaryTask = {
  readonly taskId?: unknown;
  readonly hash?: unknown;
  readonly logFile?: unknown;
  readonly cache?: { readonly status?: unknown };
  readonly execution?: {
    readonly startTime?: unknown;
    readonly endTime?: unknown;
    readonly exitCode?: unknown;
  };
};

/** Root tasks whose log the report keeps even when they pass. */
export const SPEC_GATE_TASKS: readonly string[] = [
  '//#ci:specs',
  '//#ci:spec-ownership',
];

/** How much more a status says about a task: merges keep the highest. */
const STATUS_RANK: Readonly<Record<TaskStatus, number>> = {
  'not-run': 0,
  cached: 1,
  passed: 2,
  failed: 3,
};

export function planStatus(task: PlanTask): TaskStatus {
  return task.hit ? 'cached' : 'not-run';
}

/** What a run summary says a task did, or null when the run never reached it. */
export function summaryStatus(task: SummaryTask): TaskStatus | null {
  if (task.cache?.status === 'HIT') return 'cached';
  const exitCode = task.execution?.exitCode;
  if (typeof exitCode !== 'number') return null;
  return exitCode === 0 ? 'passed' : 'failed';
}

export function summarySeconds(task: SummaryTask): number | null {
  if (task.cache?.status === 'HIT') return null;
  const start = task.execution?.startTime;
  const end = task.execution?.endTime;
  if (typeof start !== 'number' || typeof end !== 'number' || end < start) {
    return null;
  }
  return Math.round((end - start) / 100) / 10;
}

function better(a: ReportTask, b: ReportTask): ReportTask {
  return STATUS_RANK[b.status] > STATUS_RANK[a.status] ? b : a;
}

/**
 * Fold fragments into one report. The task set is the union (a plan
 * fragment names every gate task, so nothing a shard skipped goes missing);
 * each task keeps the most telling status any fragment saw.
 */
export function mergeFragments(
  fragments: readonly CheckFragment[],
  origin: string | null = null
): CheckReport {
  const byId = new Map<string, ReportTask>();
  for (const fragment of fragments) {
    for (const task of fragment.tasks) {
      const seen = byId.get(task.taskId);
      byId.set(task.taskId, seen === undefined ? task : better(seen, task));
    }
  }
  const tasks = [...byId.values()].sort(compareTasks);
  const exitCodes = fragments
    .map((fragment) => fragment.exitCode)
    .filter((code): code is number => code !== null);
  return {
    id: gateFingerprint(tasks),
    verdict: verdictOf(tasks, exitCodes),
    scm: fragments.find((fragment) => fragment.scm !== null)?.scm ?? null,
    tasks,
    specRuns: fragments.flatMap((fragment) => fragment.specRuns),
    origin,
  };
}

/**
 * Failed if any task failed or any run exited non-zero (a budget overrun
 * fails the run with every task green); incomplete if a planned task never
 * ran; passed otherwise.
 */
export function verdictOf(
  tasks: readonly ReportTask[],
  exitCodes: readonly number[]
): Verdict {
  if (tasks.some((task) => task.status === 'failed')) return 'failed';
  if (exitCodes.some((code) => code !== 0)) return 'failed';
  if (tasks.some((task) => task.status === 'not-run')) return 'incomplete';
  return 'passed';
}

/** Where a status sorts in the report: what needs a reader first. */
const STATUS_ORDER: Readonly<Record<TaskStatus, number>> = {
  failed: 0,
  'not-run': 1,
  passed: 2,
  cached: 3,
};

/** Failures first, then what never ran, what ran, what was cached; by id. */
export function compareTasks(a: ReportTask, b: ReportTask): number {
  const order = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  if (order !== 0) return order;
  return a.taskId < b.taskId ? -1 : a.taskId > b.taskId ? 1 : 0;
}

/**
 * The report id: 16 hex of a sha256 over every `taskId hash` pair, sorted.
 * Turbo's task hash already covers each task's inputs, env and dependencies,
 * so equal fingerprints mean the gate judged the exact same inputs.
 */
export function gateFingerprint(
  tasks: readonly { readonly taskId: string; readonly hash: string }[]
): string {
  const lines = tasks.map((task) => `${task.taskId} ${task.hash}`).sort();
  return createHash('sha256')
    .update(lines.join('\n'))
    .digest('hex')
    .slice(0, 16);
}

/** `@libs/friends#test:spec:0` → `['@libs/friends', 'test:spec:0']`. */
export function splitTaskId(taskId: string): readonly [string, string] {
  const at = taskId.lastIndexOf('#');
  return at < 0 ? ['//', taskId] : [taskId.slice(0, at), taskId.slice(at + 1)];
}

export function countByStatus(
  tasks: readonly ReportTask[]
): Readonly<Record<TaskStatus, number>> {
  const counts: Record<TaskStatus, number> = {
    passed: 0,
    failed: 0,
    cached: 0,
    'not-run': 0,
  };
  for (const task of tasks) counts[task.status] += 1;
  return counts;
}
