/**
 * Hard time limits for the `bun check:local` / `bun deploy:local` gate.
 *
 * Two limits, both enforced by `turbo-ci-run.ts` so every surface that runs
 * the gate (`bun check:local`, the Check workflow, the Deploy workflow) gets them:
 *
 * 1. A wall-clock **deadline** on the whole turbo run. Before it, one wedged
 *    task took the run with it — `@apps/product#test` once ran 2104s as a
 *    single `bun test` over 46 harness suites before the OS killed it (exit 137),
 *    and a local run had no way to notice. The deadline kills the
 *    turbo process group and fails loudly instead.
 * 2. A per-task **budget**, read back from turbo's `--summarize` run summary
 *    once the run finishes. Only tasks that actually executed are measured, so
 *    a warm cache never trips it.
 *
 * Budgets live in this file on purpose: making a check slower is then a
 * reviewable diff, not a silent regression. Raise a number only with the
 * measurement that justifies it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Ceiling for any task without an entry in {@link TASK_BUDGET_SECONDS}. */
export const DEFAULT_TASK_BUDGET_SECONDS = 300;

/**
 * Tasks allowed to run longer than the default, with the reason.
 * Measured on a 12-core dev laptop; CI gets {@link SLOW_RUNNER_MULTIPLIER}.
 */
export const TASK_BUDGET_SECONDS: Readonly<Record<string, number>> = {
  // Boot an embedded Postgres / Mockingbird S3 sidecar before they assert.
  '@pkgs/sql-client-postgres#test:contract': 600,
  '@pkgs/db-schema-postgres#test:contract': 600,
  '@pkgs/db-indexes-postgres#test:contract': 600,
  '@pkgs/kv-postgres#test:contract': 600,
  '@pkgs/object-store-s3#test:contract': 600,
  // One induction proof (`matching.qnt`, declared `verifyTimeoutMs` 480 s)
  // measured 330 s alone and 358 s as a task on a 12-core laptop.
  '@pkgs/matchmaking-root-harness#check:models': 480,
  // Thirteen Apalache proofs held to two at a time (2-core CI runners time
  // out above that): 303 s alone, 362 s as a task on a 12-core laptop.
  '@apps/product#test:contract': 420,
  // Every @synthetic feature and specs/journeys/ scenario, one feature file per
  // process in parallel; the journeys feature dominates — seven journeys in
  // a real browser on production latency, one fresh device each, the
  // signed-in ones first signing in (health only — never part of `bun check`).
  '@apps/product#health': 480,
};

/**
 * The Check and Deploy workflows run on 2-core GitHub-hosted runners; the budgets
 * above are measured on a dev laptop. It is a runner correction for
 * *per-task* budgets only, not slack for slower checks, and it never touches
 * the run deadline.
 */
export const SLOW_RUNNER_MULTIPLIER = 2;

/**
 * Wall-clock ceiling for a whole `check` run on a laptop.
 *
 * These are absolute, never scaled by {@link SLOW_RUNNER_MULTIPLIER}. Scaling
 * the *run* deadline is what let a Check run sit on a wedged task for 90 minutes
 * (`1800 × 3`) with nobody told why. The multiplier corrects per-task budgets
 * for a slower machine; the run deadline is the promise that a gate finishes.
 */
export const DEFAULT_RUN_DEADLINE_SECONDS = 600;

/**
 * The same ceiling on CI's 2-core runner. It must stay **below** the check
 * step's `timeout-minutes` in `.github/workflows/check.yml`, so this process kills
 * the run and names the task still running before GitHub kills the job and
 * says nothing.
 */
export const CI_RUN_DEADLINE_SECONDS = 1200;

/** `deploy` adds provision → migrate → three worker deploys → health. */
export const DEPLOY_RUN_DEADLINE_SECONDS = 2700;

/** Overrides the wall-clock deadline (seconds); `0` is rejected, not "off". */
export const RUN_DEADLINE_ENV = 'CHECK_DEADLINE_SECONDS';

export function taskBudgetSeconds(taskId: string, slowRunner: boolean): number {
  const base = Object.hasOwn(TASK_BUDGET_SECONDS, taskId)
    ? (TASK_BUDGET_SECONDS[taskId] ?? DEFAULT_TASK_BUDGET_SECONDS)
    : DEFAULT_TASK_BUDGET_SECONDS;
  return slowRunner ? base * SLOW_RUNNER_MULTIPLIER : base;
}

export type RunDeadlineOptions = {
  readonly isDeploy: boolean;
  readonly slowRunner: boolean;
};

export function resolveRunDeadlineSeconds(
  env: NodeJS.ProcessEnv,
  options: RunDeadlineOptions
): number {
  const override = Number.parseInt(env[RUN_DEADLINE_ENV]?.trim() ?? '', 10);
  if (Number.isInteger(override) && override > 0) return override;
  if (options.isDeploy) return DEPLOY_RUN_DEADLINE_SECONDS;
  return options.slowRunner
    ? CI_RUN_DEADLINE_SECONDS
    : DEFAULT_RUN_DEADLINE_SECONDS;
}

type SummaryTask = {
  readonly hash?: unknown;
  readonly taskId?: unknown;
  readonly cache?: { readonly status?: unknown };
  readonly execution?: {
    readonly exitCode?: unknown;
    readonly startTime?: unknown;
    readonly endTime?: unknown;
  };
};

export type RunSummary = { readonly tasks?: readonly SummaryTask[] };

export type TaskOverrun = {
  readonly taskId: string;
  readonly seconds: number;
  readonly budgetSeconds: number;
};

function executedSeconds(task: SummaryTask): number | null {
  if (task.cache?.status === 'HIT') return null;
  const start = task.execution?.startTime;
  const end = task.execution?.endTime;
  if (typeof start !== 'number' || typeof end !== 'number') return null;
  if (end < start) return null;
  return Math.round((end - start) / 1000);
}

/** Tasks that executed and outran their budget, slowest first. */
export function findBudgetOverruns(
  summary: RunSummary,
  slowRunner: boolean
): readonly TaskOverrun[] {
  const overruns: TaskOverrun[] = [];
  for (const task of summary.tasks ?? []) {
    const taskId = task.taskId;
    if (typeof taskId !== 'string') continue;
    const seconds = executedSeconds(task);
    if (seconds === null) continue;
    const budgetSeconds = taskBudgetSeconds(taskId, slowRunner);
    if (seconds <= budgetSeconds) continue;
    overruns.push({ taskId, seconds, budgetSeconds });
  }
  return overruns.sort((a, b) => b.seconds - a.seconds);
}

/** The slowest tasks that actually executed, for the end-of-run table. */
export function slowestExecuted(
  summary: RunSummary,
  limit: number
): readonly TaskOverrun[] {
  const rows: TaskOverrun[] = [];
  for (const task of summary.tasks ?? []) {
    const taskId = task.taskId;
    if (typeof taskId !== 'string') continue;
    const seconds = executedSeconds(task);
    if (seconds === null) continue;
    rows.push({ taskId, seconds, budgetSeconds: 0 });
  }
  return rows.sort((a, b) => b.seconds - a.seconds).slice(0, limit);
}

export function formatBudgetOverruns(overruns: readonly TaskOverrun[]): string {
  const lines = overruns.map(
    (o) =>
      `  ${o.taskId} took ${String(o.seconds)}s (budget ${String(o.budgetSeconds)}s)`
  );
  return [
    `check-budget: ${String(overruns.length)} task(s) over budget:`,
    ...lines,
    'Make the task faster (split it, cache it, shrink its inputs), or raise its',
    'entry in libs/tools/scripts/check-budget.ts with the measurement behind it.',
  ].join('\n');
}

/** Newest `.turbo/runs/*.json` written by `--summarize`, or null. */
export function readLatestRunSummary(repoRoot: string): RunSummary | null {
  const dir = join(repoRoot, '.turbo', 'runs');
  let names: readonly string[];
  try {
    names = readdirSync(dir).filter((name) => name.endsWith('.json'));
  } catch {
    return null;
  }
  let newest: { path: string; mtimeMs: number } | null = null;
  for (const name of names) {
    const path = join(dir, name);
    const mtimeMs = statSync(path).mtimeMs;
    if (newest === null || mtimeMs > newest.mtimeMs) newest = { path, mtimeMs };
  }
  if (newest === null) return null;
  try {
    return JSON.parse(readFileSync(newest.path, 'utf8')) as RunSummary;
  } catch {
    return null;
  }
}
