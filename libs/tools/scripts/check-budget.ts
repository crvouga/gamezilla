/**
 * Hard time limits for the `bun check` / `bun run deploy` gate.
 *
 * Two limits, both enforced by `turbo-ci-run.ts` so every surface that runs
 * the gate (local `bun check`, PR CI, the deploy job) gets them:
 *
 * 1. A wall-clock **deadline** on the whole turbo run. Before it, one wedged
 *    task took the run with it — `@apps/product#test` once ran 2104s as a
 *    single `bun test` over 46 sim suites before the OS killed it (exit 137),
 *    and a local `bun check` had no way to notice. The deadline kills the
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
  // Boot an embedded Postgres / S3rver / EMQX sidecar before they assert.
  '@pkgs/sql-client-postgres#test:contract': 600,
  '@pkgs/db-schema-postgres#test:contract': 600,
  '@pkgs/db-indexes-postgres#test:contract': 600,
  '@pkgs/kv-postgres#test:contract': 600,
  '@pkgs/object-store-s3#test:contract': 600,
  '@pkgs/pubsub-emqx#test:contract': 600,
  // Walks every screen in the product; the widest sim slice by design.
  '@apps/product#test:explore': 600,
  '@apps/product#test:walk': 600,
};

/**
 * PR CI and the deploy job run on 2-core GitHub-hosted runners; the budgets
 * above are measured on a dev laptop. Three is the observed ratio with
 * headroom — it is a runner correction, not slack for slower checks.
 */
export const SLOW_RUNNER_MULTIPLIER = 3;

/** Wall-clock ceiling for a whole `check` run. */
export const DEFAULT_RUN_DEADLINE_SECONDS = 1800;

/** `deploy` adds provision → migrate → three worker deploys → smoke. */
export const DEPLOY_RUN_DEADLINE_SECONDS = 3600;

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
  const base = options.isDeploy
    ? DEPLOY_RUN_DEADLINE_SECONDS
    : DEFAULT_RUN_DEADLINE_SECONDS;
  return options.slowRunner ? base * SLOW_RUNNER_MULTIPLIER : base;
}

type SummaryTask = {
  readonly taskId?: unknown;
  readonly cache?: { readonly status?: unknown };
  readonly execution?: {
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
