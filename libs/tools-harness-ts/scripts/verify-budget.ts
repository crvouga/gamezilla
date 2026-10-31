/**
 * Time limits for bounded verification and release runs.
 *
 * Two limits, both enforced by `turbo-ci-run.ts` so every surface that runs
 * the gate gets them unless it explicitly selects `VERIFY_TIME_LIMITS=off`:
 *
 * 1. A wall-clock **deadline** on the whole turbo run. Before it, one wedged
 *    task took the run with it — `@apps/product-ts#test` once ran 2104s as a
 *    single `bun test` over 46 harness suites before the OS killed it (exit 137),
 *    and a local run had no way to notice. The deadline kills the
 *    turbo process group and fails loudly instead.
 * 2. A per-task **budget**, read back from turbo's `--summarize` run summary
 *    once the run finishes. Only tasks that actually executed are measured, so
 *    a warm cache never trips it.
 *
 * Budgets live in this file on purpose: making a verification slower is then a
 * reviewable diff, not a silent regression. Raise a number only with the
 * measurement that justifies it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { verificationTimeLimitsEnabled } from '@pkgs/quint-shared-ts/wall';
import {
  profileBudgetSeconds,
  profileDeadlineSeconds,
  suiteTaskBudgetSeconds,
} from './verify-profile';

/** Ceiling for any task without an entry in {@link TASK_BUDGET_SECONDS}. */
export const DEFAULT_TASK_BUDGET_SECONDS = 300;

/**
 * Tasks allowed to run longer than the default, with the reason.
 * Measured on a 12-core dev laptop; CI gets {@link SLOW_RUNNER_MULTIPLIER}.
 */
export const TASK_BUDGET_SECONDS: Readonly<Record<string, number>> = {
  // Boot a Mockingbird Postgres / Mockingbird S3 sidecar before they assert.
  '@pkgs/sql-client-postgres#test:contract': 600,
  '@pkgs/db-schema-postgres#test:contract': 600,
  '@pkgs/db-indexes-postgres#test:contract': 600,
  '@pkgs/kv-postgres#test:contract': 600,
  '@pkgs/object-store-s3#test:contract': 600,
  // `matching.qnt` pairUp (phase 4) measured about 200 s; the overlapped
  // proof measured 358 s as one task on a 12-core laptop. The two tasks
  // keep that budget until a cold run on the warm runner remeasures them.
  // Twelve serial phase tasks would add up past the run deadline, because
  // one solver slot runs them one at a time.
  '@pkgs/matchmaking-root-harness-ts#verify:models:0': 480,
  '@pkgs/matchmaking-root-harness-ts#verify:models:1': 480,
  // The matched-game proof retains every original clause and the two-step bound.
  // Bundled time-control and move-count clauses exceeded their task allowance.
  // Verify each property separately, retaining the existing 420-second allowance.
  ...Object.fromEntries(
    Array.from({ length: 16 }, (_, index) => [
      `@libs/games-harness-ts#verify:models:10:${String(index)}`,
      420,
    ])
  ),
  // The eleven symbolic models used to share one task. Release 38446818279
  // killed that task at 840 s on a 2-core runner (Verify concurrency 1) before
  // it finished. Each part keeps that same allowance for one model; the
  // fair-recovery part also runs the two temporal verifications.
  ...Object.fromEntries(
    Array.from({ length: 11 }, (_, index) => [
      `@apps/product-ts#test:contract:${String(index)}`,
      420,
    ])
  ),
  // Every @synthetic feature and specs/journeys/ scenario, one feature file per
  // process in parallel; the journeys feature dominates — seven journeys in
  // a real browser on production latency, one fresh device each, the
  // signed-in ones first signing in (health only — never part of `bun verify`).
  '@apps/product-ts#health': 480,
  // regression: games-spec-part-two-exceeds-task-budget
  // Hashed to this part: custom-game-away.feature (unsliced, every
  // conformance game) alongside slices of matched-game-without-turns,
  // multi-seat-stand-ins and puzzle-play — each also run once per game.
  // `specWeight` counts only the Gherkin text's scenario lines, not the
  // per-game multiplication every shared `specs/games/` feature gets at run
  // time, so this part's declared load clears PART_LOAD while its real test
  // count (79 across 5 files) does not. Measured 312 s with
  // VERIFY_TEST_CONCURRENCY=1 on a 12-core laptop (above the 300 s default);
  // PR #241 Verify run 40824282900, shard 31, stopped it at the 600 s CI
  // budget (`@libs/games-harness-ts#test:spec:2 ran past its own time
  // budget`).
  '@libs/games-harness-ts#test:spec:2': 420,
};

/**
 * The conservative CI correction retains the 2-core hosted measurements; the budgets
 * above are measured on a dev laptop. It is a runner correction for
 * *per-task* budgets only, not slack for slower verifications, and it never touches
 * the run deadline.
 */
export const SLOW_RUNNER_MULTIPLIER = 2;

/**
 * Wall-clock ceiling for a whole `verify` run on a laptop.
 *
 * These are absolute, never scaled by {@link SLOW_RUNNER_MULTIPLIER}. Scaling
 * the *run* deadline is what let a Verify run sit on a wedged task for 90 minutes
 * (`1800 × 3`) with nobody told why. The multiplier corrects per-task budgets
 * for a slower machine; the run deadline is the promise that a gate finishes.
 */
export const DEFAULT_RUN_DEADLINE_SECONDS = 600;

/**
 * The same ceiling for a full Verify shard on CI's 2-core runner. It must stay
 * **below** that shard step's `timeout-minutes` in `.github/workflows/verify-pr.yml`,
 * so this process kills the run and names the task still running before GitHub
 * kills the job and says nothing. Contract tasks are budgeted up to this.
 */
export const CI_RUN_DEADLINE_SECONDS = 1200;

/**
 * Wall-clock ceiling on a warm CI runner (16 cores or more): 30 s warm
 * start, 240 s of work, 15 s to post the verdict. A 2-core hosted runner
 * stays on {@link CI_RUN_DEADLINE_SECONDS}.
 */
export const WARM_RUN_DEADLINE_SECONDS = 270;

/** Cores at which a CI machine is the warm runner, not the hosted 2-core. */
export const WARM_RUNNER_MIN_CPUS = 16;

/**
 * After the deadline, SIGTERM and wait this long so turbo can finish
 * uploading tasks that already completed, then SIGKILL.
 */
export const DEADLINE_FLUSH_MS = 15_000;

/** `deploy` adds provision → migrate → three worker releases → health. */
export const DEPLOY_RUN_DEADLINE_SECONDS = 2700;

/** Overrides the wall-clock deadline (seconds); `0` is rejected, not "off". */
export const RUN_DEADLINE_ENV = 'VERIFY_DEADLINE_SECONDS';

export function taskBudgetSeconds(
  taskId: string,
  slowRunner: boolean,
  env: NodeJS.ProcessEnv = process.env
): number {
  if (!verificationTimeLimitsEnabled(env)) return Number.POSITIVE_INFINITY;
  const suite = suiteTaskBudgetSeconds(taskId);
  if (suite !== null) return suite;
  const base = Object.hasOwn(TASK_BUDGET_SECONDS, taskId)
    ? (TASK_BUDGET_SECONDS[taskId] ?? DEFAULT_TASK_BUDGET_SECONDS)
    : DEFAULT_TASK_BUDGET_SECONDS;
  // The nightly profile runs the same task deeper (`verify-profile.ts`).
  return profileBudgetSeconds(
    slowRunner ? base * SLOW_RUNNER_MULTIPLIER : base,
    env
  );
}

export type RunDeadlineOptions = {
  readonly isDeploy: boolean;
  readonly slowRunner: boolean;
  /** CI with {@link WARM_RUNNER_MIN_CPUS} or more. Wins over `slowRunner`. */
  readonly warmRunner?: boolean;
};

/** Hosted 2-core CI. A warm runner and a laptop are not slow. */
export function slowCiRunner(ci: boolean, cpus: number): boolean {
  return ci && cpus < WARM_RUNNER_MIN_CPUS;
}

export function resolveRunDeadlineSeconds(
  env: NodeJS.ProcessEnv,
  options: RunDeadlineOptions
): number {
  if (!verificationTimeLimitsEnabled(env)) return Number.POSITIVE_INFINITY;
  const override = Number.parseInt(env[RUN_DEADLINE_ENV]?.trim() ?? '', 10);
  if (Number.isInteger(override) && override > 0) return override;
  if (options.isDeploy) return DEPLOY_RUN_DEADLINE_SECONDS;
  const profile = profileDeadlineSeconds(
    env,
    options.slowRunner || options.warmRunner === true
  );
  if (profile !== null) return profile;
  if (options.warmRunner === true) return WARM_RUN_DEADLINE_SECONDS;
  return options.slowRunner
    ? CI_RUN_DEADLINE_SECONDS
    : DEFAULT_RUN_DEADLINE_SECONDS;
}

/** A deadline or an external signal fails the gate even if turbo exits 0. */
export function gateExitCode(input: {
  readonly deadlineHit: boolean;
  readonly signal: NodeJS.Signals | null;
  readonly code: number | null;
  readonly published: boolean;
}): number {
  if (input.deadlineHit || input.signal !== null) return 124;
  return input.published ? (input.code ?? 1) : 1;
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
  slowRunner: boolean,
  env: NodeJS.ProcessEnv = process.env
): readonly TaskOverrun[] {
  const overruns: TaskOverrun[] = [];
  for (const task of summary.tasks ?? []) {
    const taskId = task.taskId;
    if (typeof taskId !== 'string') continue;
    const seconds = executedSeconds(task);
    if (seconds === null) continue;
    const budgetSeconds = taskBudgetSeconds(taskId, slowRunner, env);
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
    `verify-budget: ${String(overruns.length)} task(s) over budget:`,
    ...lines,
    'Make the task faster (split it, cache it, shrink its inputs), or raise its',
    'entry in libs/tools-harness-ts/scripts/verify-budget.ts with the measurement behind it.',
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
