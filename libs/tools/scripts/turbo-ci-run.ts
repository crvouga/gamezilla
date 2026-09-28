/**
 * Shared Turbo flags for CI / local `check` / `deploy`.
 *
 * - Cache is `local:rw,remote:rw` (self-hosted remote at
 *   `https://turborepo.chrisvouga.dev`) when `TURBO_TOKEN` is present
 *   (`TURBO_TEAM` defaults to the constant slug; telemetry is disabled). Local disk under `.turbo` is also persisted in CI via per-job
 *   `actions/cache`. `TURBO_CACHE` may tighten local/remote modes but cannot
 *   drop `remote:` when creds are present.
 * - CI requires `TURBO_TOKEN`. Locally, a missing token (Infisical
 *   login/network fallback) use `local:rw` so `bun check` still runs.
 * - Disables framework inference so only explicit `turbo.json` `env` /
 *   `globalEnv` enter the hash (avoids `VITE_*` skew).
 * - Ensures `TURBO_API` points at the self-hosted cache origin (defaults when
 *   remote creds are present but the secret is unset).
 * - No affected-package filter: every gate task is cached per package, so an
 *   unchanged package is a cache hit, which is the same saving without a
 *   second notion of "what changed" to keep correct. The one input turbo
 *   cannot see — which commits a change adds — is exported as
 *   `CHECK_SECRETS_RANGE` (`<merge-base>..<head>`) for `check:secrets`.
 * - Plan first (`turbo-preflight.ts`): `--dry=json` asks the local cache
 *   about every task (~4s), then the remote about the local misses only, in
 *   parallel. All hits → the gate already passed for these inputs, so
 *   turbo is not run at all. Otherwise turbo runs only the missed task ids
 *   (plus their `dependsOn` closure, same hashes), after the closure's remote
 *   hits are prefetched in parallel into the local cache — so `--concurrency`
 *   slots go to real work, not ~400 serialized cross-country cache restores.
 * - Concurrency: honor `TURBO_CONCURRENCY`; otherwise `availableParallelism()`
 *   with a local floor of 4 and a CI floor of 2 (2-core / 7GB runners).
 * - Log order: `auto` locally; `grouped` in CI, which turbo renders as one
 *   collapsible `::group::` per failing task on GitHub Actions. Grouped holds
 *   a task's output until it finishes, so a heartbeat prints every 2 min.
 *   Override with `TURBO_LOG_ORDER`. `check` / `deploy` (and `//#…` forms)
 *   are expanded recursively to leaf `dependsOn` tasks so turbo never nests
 *   under a root aggregator script (would recurse).
 * - Output logs: `errors-only` — a task's output is printed only when that
 *   task fails, so a green gate prints the plan, the heartbeat and the
 *   summary and nothing a passing test wrote. Override with
 *   `TURBO_OUTPUT_LOGS` (`full` / `new-only`) to watch a run locally.
 * - UI: turbo ignores a `TURBO_UI` env var — pass `--ui=tui|stream` via
 *   `TURBO_UI` here (CI sets `stream`; local `deploy:*` sets `tui`).
 * - Time limits: the run is killed at a hard wall-clock deadline, and every
 *   task that executed is checked against its per-task budget once the run
 *   finishes. Both live in `check-budget.ts`.
 * - Durations: every exit prints the run's wall time and each phase's share
 *   (plan, prefetch, turbo), cache-hit-only runs included.
 * - `--restore-outputs` (`bun check:report --restore`): leave every task's cached
 *   outputs on disk. A plain run skips turbo when everything hit, which is
 *   right for a verdict but restores nothing; this mode prefetches every
 *   remote hit, runs turbo over the whole set (hits restore their outputs,
 *   misses run) and `--continue`s past a failing task so every suite
 *   reports.
 * - Report: a `check` run renders one standalone HTML report of the whole
 *   gate into `.cache/check-report/<fingerprint>/` (`bun check:report` opens
 *   it; `check-report/` has the rest). `--report-fragment=<path>` writes the
 *   run's raw fragment instead, which is how CI's plan and shards hand their
 *   parts to the `check:report` job that merges them.
 */
import { type ChildProcess, spawn } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import {
  DEFAULT_TURBO_API,
  TURBO_TEAM,
} from '@libs/secrets/shared/secrets/turbo-token';
import { killOrphanEsbuildServices } from '@pkgs/os/kill-orphan-esbuild';
import {
  findBudgetOverruns,
  formatBudgetOverruns,
  readLatestRunSummary,
  resolveRunDeadlineSeconds,
  slowestExecuted,
} from './check-budget';
import { reportRun } from './check-report/run';
import { runSummaryNames } from './check-report/summaries';
import {
  formatShardPlan,
  planShards,
  readTaskCosts,
  shardPlanOutputs,
} from './check-shards';
import { describeRunningTasks } from './running-tasks';
import { SECRETS_RANGE_ENV, secretsScanRange } from './secrets-scan-range';
import {
  dryRunPlan,
  localCacheFlag,
  prefetchRemoteHits,
  REMOTE_LOOKUP_CONCURRENCY,
  type RunPlan,
  readsRemoteCache,
  resolveRemoteHits,
  restoreEveryHit,
  wallRemoteHas,
} from './turbo-preflight';

const REPO_ROOT = join(import.meta.dirname, '../../..');
const CHECK_AGGREGATOR = '//#check';
const DEPLOY_AGGREGATOR = '//#deploy';
/**
 * The live health checks and critical journeys (`@apps/product#health`,
 * `specs/health/` + `specs/journeys/`). Deliberately no `//#health` root
 * task: the root `health` script would make a bare `health` dependency
 * resolve to that root task itself, a cycle turbo refuses to plan.
 */
const HEALTH_TASK = 'health';

const PLATFORM_KEY_PATH = join(REPO_ROOT, 'turbo-platform-key.json');

/**
 * Turborepo's hash knows nothing about the platform
 * (https://turborepo.dev/docs/guides/handling-platforms), so a macOS result
 * could satisfy a Linux run. The platform-scoped `test:contract` leaves
 * (embedded Postgres / S3rver / EMQX binaries) declare this file as an input,
 * so their caches are per-platform while everything portable (tc, lint, unit
 * tests) still shares one cache across machines. Written on every run: absent
 * (a bare `turbo run`) hashes differently, which costs a cache miss, never
 * correctness.
 */
function writePlatformCacheKey(): void {
  const key = {
    platform: process.platform,
    arch: process.arch,
    bun: Bun.version,
  };
  writeFileSync(PLATFORM_KEY_PATH, `${JSON.stringify(key, null, 2)}\n`);
}

/** Root-package script names and turbo root-task aliases that are aggregators. */
const AGGREGATOR_ALIASES: Readonly<Record<string, string>> = {
  check: CHECK_AGGREGATOR,
  '//#check': CHECK_AGGREGATOR,
  '//:check': CHECK_AGGREGATOR,
  deploy: DEPLOY_AGGREGATOR,
  '//#deploy': DEPLOY_AGGREGATOR,
  '//:deploy': DEPLOY_AGGREGATOR,
};

/**
 * `deploy`: the full release graph. `health`: live-resource probes only —
 * the `health` tasks declare the deploy chain in `dependsOn` so deploy orders
 * them last, and a standalone health run passes turbo's `--only` so it probes
 * what is live without deploying anything. `plain`: everything else.
 */
export type RunMode = 'deploy' | 'health' | 'plain';

export function resolveRunMode(rawTaskArgs: readonly string[]): RunMode {
  const requested = new Set(
    rawTaskArgs
      .filter((arg) => Object.hasOwn(AGGREGATOR_ALIASES, arg))
      .map((arg) => AGGREGATOR_ALIASES[arg])
  );
  if (requested.has(DEPLOY_AGGREGATOR)) return 'deploy';
  if (rawTaskArgs.includes(HEALTH_TASK)) return 'health';
  return 'plain';
}

/**
 * Turbo flags a run mode adds. Standalone health: `--only` keeps it off the
 * deploy chain, and `--continue` lets every probe report instead of stopping at
 * the first failure (probes are independent and deploy nothing). Deploy keeps
 * turbo's stop-on-first-failure: its deploy steps do not depend on the check
 * leaves, so continuing past a failed check could ship.
 */
export function runModeFlags(mode: RunMode): readonly string[] {
  return mode === 'health'
    ? ['--only', '--continue=dependencies-successful']
    : [];
}

const TURBO_CACHE_RE = /^(local|remote):(r|rw|w)?(,(local|remote):(r|rw|w)?)?$/;
const TURBO_UI_VALUES = new Set(['tui', 'stream']);
const DEFAULT_CACHE = 'local:rw,remote:rw';
const LOCAL_ONLY_CACHE = 'local:rw';
const MIN_CHECK_CONCURRENCY = 4;
const CACHE_WORKERS = 16;

type TurboTasks = Record<string, { dependsOn?: unknown }>;

function inGithubActions(): boolean {
  return process.env['GITHUB_ACTIONS'] === 'true';
}

function inCi(): boolean {
  return inGithubActions() || process.env['CI'] === 'true';
}

export function hasRemoteCreds(env: NodeJS.ProcessEnv): boolean {
  const token = env['TURBO_TOKEN']?.trim();
  return token !== undefined && token.length > 0;
}

function ensureRemoteCache(cache: string): string {
  if (cache.includes('remote:')) return cache;
  return `${cache},remote:rw`;
}

export function resolveCacheFlag(
  env: NodeJS.ProcessEnv,
  hasRemote: boolean
): string {
  if (!hasRemote) return LOCAL_ONLY_CACHE;
  const fromEnv = env['TURBO_CACHE']?.trim();
  if (
    fromEnv !== undefined &&
    fromEnv.length > 0 &&
    TURBO_CACHE_RE.test(fromEnv)
  ) {
    if (fromEnv.includes(',')) return ensureRemoteCache(fromEnv);
    if (fromEnv.startsWith('remote:')) return `local:rw,${fromEnv}`;
    return ensureRemoteCache(fromEnv);
  }

  return DEFAULT_CACHE;
}

function resolveConcurrency(): string {
  const fromEnv = process.env['TURBO_CONCURRENCY']?.trim();
  if (fromEnv !== undefined && fromEnv.length > 0) return fromEnv;
  const cpus = availableParallelism();
  const min = inCi() ? 2 : MIN_CHECK_CONCURRENCY;
  return String(Math.max(cpus, min));
}

function resolveUi(): string | undefined {
  const fromEnv = process.env['TURBO_UI']?.trim();
  if (
    fromEnv !== undefined &&
    fromEnv.length > 0 &&
    TURBO_UI_VALUES.has(fromEnv)
  ) {
    return fromEnv;
  }
  return undefined;
}

/**
 * Turbo child env: telemetry off, and for the self-hosted remote cache the
 * constant `TURBO_TEAM` plus a normalized / defaulted `TURBO_API`.
 */
export function turboChildEnv(
  source: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { TURBO_TELEMETRY_DISABLED: '1', ...source };
  if (!hasRemoteCreds(env)) return env;
  if ((env['TURBO_TEAM']?.trim() ?? '') === '') env['TURBO_TEAM'] = TURBO_TEAM;
  const api = env['TURBO_API']?.trim() ?? '';
  env['TURBO_API'] =
    api.length > 0 ? api.replace(/\/+$/, '') : DEFAULT_TURBO_API;
  return env;
}

function loadTurboTasks(): TurboTasks {
  const turboJson = JSON.parse(
    readFileSync(join(REPO_ROOT, 'turbo.json'), 'utf8')
  ) as { tasks?: TurboTasks };
  if (turboJson.tasks === undefined) {
    throw new Error('turbo.json missing tasks');
  }
  return turboJson.tasks;
}

function taskDependsOn(tasks: TurboTasks, taskName: string): string[] {
  const deps = tasks[taskName]?.dependsOn;
  if (!Array.isArray(deps)) {
    throw new Error(`turbo.json missing ${taskName} dependsOn`);
  }
  return deps.filter((dep): dep is string => typeof dep === 'string');
}

/**
 * Recursively expand `check` / `deploy` aggregators to leaf turbo tasks.
 * Dedupes while preserving first-seen order.
 */
export function flattenCheckAggregators(
  taskArgs: readonly string[],
  tasks: TurboTasks = loadTurboTasks()
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  function pushLeaf(leaf: string): void {
    if (seen.has(leaf)) return;
    seen.add(leaf);
    out.push(leaf);
  }

  // Bare script names (`check`, `deploy`) are aliases only on the command
  // line; inside `dependsOn` a bare name is a package task, so nested deps
  // expand only when they name a root aggregator.
  function expand(arg: string, commandLine: boolean): void {
    const isAlias = Object.hasOwn(AGGREGATOR_ALIASES, arg);
    const canonical =
      isAlias && (commandLine || arg.startsWith('//'))
        ? AGGREGATOR_ALIASES[arg]
        : undefined;
    if (canonical === undefined) {
      pushLeaf(arg);
      return;
    }
    for (const dep of taskDependsOn(tasks, canonical)) {
      expand(dep, false);
    }
  }

  for (const arg of taskArgs) {
    expand(arg, true);
  }

  return out;
}

function requireRemoteCredsInCi(hasRemote: boolean): void {
  if (hasRemote || !inCi()) return;
  console.error(
    'turbo-ci-run: TURBO_TOKEN is required for self-hosted Turbo remote cache. ' +
      'Run via secrets-run / secrets-auth (Infisical) so local warms upload and CI reuses them.'
  );
  process.exit(1);
}

function warnLocalCacheOnly(hasRemote: boolean): void {
  if (hasRemote) return;
  console.warn(
    'turbo-ci-run: TURBO_TOKEN missing; using local cache only. ' +
      'Run `bun run secrets:pull` so local warms upload to the self-hosted Turbo remote cache.'
  );
}

/** Deploy writes remote artifacts CI reuses; it never runs cache-local. */
function requireRemoteCredsForDeploy(hasRemote: boolean, mode: RunMode): void {
  if (hasRemote || mode !== 'deploy') return;
  console.error(
    'turbo-ci-run: deploy requires TURBO_TOKEN. ' +
      'Run `bun run secrets:pull` then retry via secrets-run.'
  );
  process.exit(1);
}

/** Each phase's wall time, in the order the phases ran. */
export type PhaseDurations = readonly (readonly [phase: string, ms: number])[];

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/** `turbo-ci-run: finished in 9.1s (plan 1.2s, prefetch 0.3s, turbo 7.6s)` */
export function formatDurations(
  totalMs: number,
  phases: PhaseDurations
): string {
  const parts = phases.map(([phase, ms]) => `${phase} ${formatSeconds(ms)}`);
  return (
    `turbo-ci-run: finished in ${formatSeconds(totalMs)}` +
    (parts.length > 0 ? ` (${parts.join(', ')})` : '')
  );
}

const STARTED = process.hrtime.bigint();
const phases: [phase: string, ms: number][] = [];

function msSince(start: bigint): number {
  return Number((process.hrtime.bigint() - start) / 1_000_000n);
}

async function timed<T>(phase: string, run: () => T | Promise<T>): Promise<T> {
  const start = process.hrtime.bigint();
  try {
    return await run();
  } finally {
    phases.push([phase, msSince(start)]);
  }
}

function exitWithDurations(code: number): never {
  console.log(formatDurations(msSince(STARTED), phases));
  process.exit(code);
}

/** The turbo flags every run passes, and a one-line summary of them. */
function turboCiFlags(cache: string): {
  readonly flags: readonly string[];
  readonly summary: string;
} {
  const concurrency = resolveConcurrency();
  const outputLogs = process.env['TURBO_OUTPUT_LOGS']?.trim() || 'errors-only';
  const logOrder =
    process.env['TURBO_LOG_ORDER']?.trim() || (inCi() ? 'grouped' : 'auto');
  const ui = resolveUi();
  return {
    flags: [
      `--concurrency=${concurrency}`,
      `--cache-workers=${String(CACHE_WORKERS)}`,
      `--cache=${cache}`,
      '--framework-inference=false',
      '--summarize',
      `--output-logs=${outputLogs}`,
      `--log-order=${logOrder}`,
      ...(ui !== undefined ? [`--ui=${ui}`] : []),
    ],
    summary:
      `cache=${cache} concurrency=${concurrency} log-order=${logOrder}` +
      (ui !== undefined ? ` ui=${ui}` : ''),
  };
}

type Cli = {
  readonly planShardsOnly: boolean;
  readonly restoreOutputs: boolean;
  readonly fragmentPath: string | null;
  /** What is left for turbo: task names and turbo's own flags. */
  readonly rawTaskArgs: readonly string[];
};

function parseCli(argv: readonly string[]): Cli {
  const rawTaskArgs = argv
    .slice(2)
    .filter(
      (arg) =>
        arg !== PLAN_SHARDS_FLAG &&
        arg !== RESTORE_OUTPUTS_FLAG &&
        !arg.startsWith(REPORT_FRAGMENT_FLAG)
    );
  if (rawTaskArgs.length === 0) {
    console.error(
      'usage: bun run libs/tools/scripts/turbo-ci-run.ts <turbo run args…>'
    );
    process.exit(1);
  }
  return {
    planShardsOnly: argv.includes(PLAN_SHARDS_FLAG),
    restoreOutputs: argv.includes(RESTORE_OUTPUTS_FLAG),
    fragmentPath: reportFragmentPath(argv),
    rawTaskArgs,
  };
}

async function main(): Promise<void> {
  const env = turboChildEnv();
  writePlatformCacheKey();

  const remote = hasRemoteCreds(env);
  requireRemoteCredsInCi(remote);
  warnLocalCacheOnly(remote);

  const cache = resolveCacheFlag(env, remote);
  const turbo = turboCiFlags(cache);
  const { planShardsOnly, restoreOutputs, fragmentPath, rawTaskArgs } =
    parseCli(process.argv);

  const mode = resolveRunMode(rawTaskArgs);
  requireRemoteCredsForDeploy(remote, mode);
  const taskArgs = flattenCheckAggregators(rawTaskArgs);
  env[SECRETS_RANGE_ENV] = secretsScanRange(env);

  const slowRunner = inCi();
  const deadlineSeconds = resolveRunDeadlineSeconds(process.env, {
    isDeploy: mode === 'deploy',
    slowRunner,
  });

  console.log(
    `turbo-ci-run: ${turbo.summary} deadline=${String(deadlineSeconds)}s` +
      (remote
        ? ` (remote creds present; api=${env['TURBO_API'] ?? DEFAULT_TURBO_API})`
        : ' (local cache only)')
  );

  const fullRunArgs = [
    'run',
    ...taskArgs,
    ...rootExcludeFiltersFor(taskArgs),
    ...runModeFlags(mode),
  ];
  const planned = await timed('plan', () =>
    planOrNull(fullRunArgs, cache, env)
  );
  const report = (
    summariesBefore: ReadonlySet<string> | null,
    exitCode: number | null
  ) =>
    reportRun({
      repoRoot: REPO_ROOT,
      plan: planned?.tasks ?? null,
      summariesBefore,
      exitCode,
      fragmentPath,
      render: mode === 'plain' && requestsCheck(rawTaskArgs),
      frames: process.env['HARNESS_FRAMES'] === '1',
    });
  if (planShardsOnly) {
    await report(null, null);
    writeShardPlanAndExit(planned, taskArgs);
  }
  const plan = restoreOutputs && planned ? restoreEveryHit(planned) : planned;
  if (plan !== null && plan.toExecute.length === 0 && !restoreOutputs) {
    const code = finalExitCode({ status: 0, slowRunner, ran: false });
    await report(null, code);
    exitWithDurations(code);
  }
  if (plan !== null && plan.remoteHits.length > 0) {
    await timed('prefetch', () => prefetchRemoteHits(plan, REPO_ROOT, env));
  }
  const runArgs = turboRunArgs(fullRunArgs, plan, restoreOutputs);

  const summariesBefore = runSummaryNames(REPO_ROOT);
  const stopHeartbeat = startHeartbeat();
  const status = await timed('turbo', () =>
    runTurbo([...runArgs, ...turbo.flags], env, { deadlineSeconds })
  );
  stopHeartbeat();

  // Reap any esbuild --service workers orphaned by force-exited tasks.
  killOrphanEsbuildServices({ commandIncludes: REPO_ROOT });
  const code = finalExitCode({ status, slowRunner, ran: true });
  await timed('report', () => report(summariesBefore, code));
  exitWithDurations(code);
}

/** Whether the command line asks for the `bun check` gate. */
export function requestsCheck(rawTaskArgs: readonly string[]): boolean {
  return rawTaskArgs.some(
    (arg) =>
      Object.hasOwn(AGGREGATOR_ALIASES, arg) &&
      AGGREGATOR_ALIASES[arg] === CHECK_AGGREGATOR
  );
}

/** `--report-fragment=<path>`: where to write this run's report fragment. */
export function reportFragmentPath(argv: readonly string[]): string | null {
  const arg = argv.find((a) => a.startsWith(REPORT_FRAGMENT_FLAG));
  const path = arg?.slice(REPORT_FRAGMENT_FLAG.length) ?? '';
  return path === '' ? null : path;
}

/**
 * What turbo runs once the plan is in: only the misses (their `dependsOn`
 * closure comes along with the same hashes), or — restoring outputs — the
 * whole set, so every hit restores its outputs, continuing past a failure.
 */
function turboRunArgs(
  fullRunArgs: readonly string[],
  plan: RunPlan | null,
  restoreOutputs: boolean
): string[] {
  if (restoreOutputs) return [...fullRunArgs, '--continue'];
  if (plan === null) return [...fullRunArgs];
  return ['run', ...plan.toExecute.map((task) => task.taskId)];
}

const PLAN_SHARDS_FLAG = '--plan-shards';
const RESTORE_OUTPUTS_FLAG = '--restore-outputs';
const REPORT_FRAGMENT_FLAG = '--report-fragment=';
const SHARD_PLAN_PATH_ENV = 'SHARD_PLAN_PATH';

/**
 * `--plan-shards`: split the misses across CI runners (`check-shards.ts`) and
 * hand the split to the workflow instead of running anything. Without a plan
 * (the dry run failed) one shard runs the whole requested set unplanned.
 */
function writeShardPlanAndExit(
  plan: RunPlan | null,
  taskArgs: readonly string[]
): never {
  const shardPlan =
    plan === null
      ? { shards: [[...taskArgs]], costs: [0] }
      : planShards(plan, readTaskCosts());
  console.log(formatShardPlan(shardPlan));
  // Not `$GITHUB_OUTPUT`: this job loads every secret, the runner masks each
  // stored value (one is `1`), and it silently drops any job output holding a
  // masked value — `[0,1,…]` always does. The workflow publishes this file
  // from a job that loads no secrets.
  const outputPath = process.env[SHARD_PLAN_PATH_ENV];
  if (outputPath !== undefined && outputPath !== '') {
    appendFileSync(outputPath, shardPlanOutputs(shardPlan));
  }
  process.exit(0);
}

/**
 * Exclude the root workspace from package tasks so root scripts like `lint`
 * (which themselves call turbo-ci-run) are never scheduled.
 */
function rootExcludeFiltersFor(taskArgs: readonly string[]): string[] {
  const hasExplicitFilter = taskArgs.some((a) => a.startsWith('--filter='));
  // `pkg#task` ids name their package already; only bare task names need
  // the root workspace excluded.
  const hasPackageTasks = taskArgs.some(
    (a) => !a.startsWith('//') && !a.startsWith('--') && !a.includes('#')
  );
  if (hasExplicitFilter || !hasPackageTasks) return [];
  const filters = [
    '--filter=./apps/*',
    '--filter=./libs/*',
    '--filter=./pkgs/*',
  ];
  if (taskArgs.some((a) => a.startsWith('//'))) filters.push('--filter=//');
  return filters;
}

const LISTED_MISSES = 25;

/**
 * Dry-run the exact task set (see `turbo-preflight.ts`). `null` when the dry
 * run itself fails: the real run then goes ahead unplanned — the verdict is
 * always the real run's, the plan only decides how much of it to skip.
 */
async function planOrNull(
  runArgs: readonly string[],
  cache: string,
  env: NodeJS.ProcessEnv
): Promise<RunPlan | null> {
  // The misses are re-run by id alone, so a caller's own turbo flags
  // (`--force`, `--continue`, …) would be dropped: plan only plain task sets.
  const flags = runArgs.filter((arg) => arg.startsWith('-'));
  if (flags.some((flag) => !flag.startsWith('--filter='))) return null;
  // Turbo's own remote lookup is one request per task, in series; ask the
  // local cache here and the remote about the local misses, in parallel.
  const local = localCacheFlag(cache);
  const askRemote = local !== null && readsRemoteCache(cache);
  let plan: RunPlan;
  try {
    plan = dryRunPlan(
      [...runArgs, `--cache=${local ?? cache}`, '--framework-inference=false'],
      REPO_ROOT,
      env
    );
    if (askRemote && plan.toExecute.length > 0) {
      plan = await resolveRemoteHits(
        plan,
        wallRemoteHas(env),
        REMOTE_LOOKUP_CONCURRENCY
      );
    }
  } catch (error) {
    console.warn(
      `turbo-ci-run: dry run failed (${String(error)}); running unplanned.`
    );
    return null;
  }
  const cached = plan.tasks.length - plan.toExecute.length;
  console.log(
    `turbo-ci-run: ${String(plan.tasks.length)} tasks — ${String(cached)} cached, ` +
      `${String(plan.toExecute.length)} to execute`
  );
  for (const task of plan.toExecute.slice(0, LISTED_MISSES)) {
    console.log(`  miss  ${task.taskId}`);
  }
  if (plan.toExecute.length > LISTED_MISSES) {
    console.log(
      `  … and ${String(plan.toExecute.length - LISTED_MISSES)} more`
    );
  }
  if (plan.toExecute.length === 0) {
    console.log(
      'turbo-ci-run: every task is a cache hit (a cached result is a passed ' +
        'result for these exact inputs); nothing to run.'
    );
  }
  return plan;
}

const HEARTBEAT_MS = 120_000;

/**
 * GitHub SIGTERMs a step that prints nothing for ~10 min (exit 143), and the
 * grouped log order holds each task's output until it finishes. A heartbeat
 * in-process — not a background shell loop, whose orphaned `sleep` held the
 * step's stdout open for seconds after the run was done.
 */
function startHeartbeat(): () => void {
  if (!inGithubActions()) return () => undefined;
  const started = process.hrtime.bigint();
  const timer = setInterval(() => {
    const seconds = Number(
      (process.hrtime.bigint() - started) / 1_000_000_000n
    );
    console.log(`turbo-ci-run: still running (${String(seconds)}s)`);
  }, HEARTBEAT_MS);
  return () => clearInterval(timer);
}

/**
 * Zero only when turbo passed and every executed task was inside its budget.
 */
function finalExitCode(args: {
  readonly status: number;
  readonly slowRunner: boolean;
  /** False when the plan found nothing to execute: no summary to measure. */
  readonly ran: boolean;
}): number {
  // The timing table prints even when a task failed — that is exactly when
  // someone is reading the log and wants to know where the time went.
  const budget = args.ran ? enforceTaskBudgets(args.slowRunner) : 0;
  if (args.status !== 0) return args.status;
  return budget;
}

/**
 * Fail a run whose tasks were individually too slow. Read from turbo's own
 * `--summarize` output, so cache hits (which did no work) are never measured.
 */
function enforceTaskBudgets(slowRunner: boolean): number {
  const summary = readLatestRunSummary(REPO_ROOT);
  if (summary === null) {
    console.warn(
      'turbo-ci-run: no turbo run summary found; per-task budgets not checked.'
    );
    return 0;
  }
  // Print it every run: without this the CI log says how long the whole gate
  // took and nothing about where it went, and the only way to find the slow
  // task was to guess.
  const slowest = slowestExecuted(summary, 10);
  if (slowest.length > 0) {
    console.log('turbo-ci-run: slowest tasks that ran');
    for (const row of slowest) {
      console.log(`  ${String(row.seconds).padStart(5)}s  ${row.taskId}`);
    }
  }
  const overruns = findBudgetOverruns(summary, slowRunner);
  if (overruns.length === 0) return 0;
  console.error(formatBudgetOverruns(overruns));
  return 1;
}

type RunTurboOptions = {
  readonly deadlineSeconds: number;
};

/** SIGKILL the turbo process group; a wedged task rarely dies with turbo. */
function killTree(child: ChildProcess, signal: NodeJS.Signals): void {
  const pid = child.pid;
  if (pid === undefined) return;
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      // already exited
    }
  }
}

/**
 * Kill the run at `deadlineSeconds`. Returns a disarm callback.
 *
 * `detached: true` puts turbo in its own process group so the whole tree dies
 * with it; the price is that the terminal's Ctrl-C no longer reaches it, so
 * SIGINT / SIGTERM are forwarded here instead.
 */
function armDeadline(child: ChildProcess, deadlineSeconds: number): () => void {
  const forward = (signal: NodeJS.Signals) => () => {
    killTree(child, signal);
  };
  const onInt = forward('SIGINT');
  const onTerm = forward('SIGTERM');
  process.on('SIGINT', onInt);
  process.on('SIGTERM', onTerm);
  const timer = setTimeout(() => {
    console.error(
      `turbo-ci-run: hard deadline of ${String(deadlineSeconds)}s reached; killing the run.`
    );
    // SIGKILL leaves turbo no chance to report, so name the running tasks
    // first: one long-running task is a wedge to fix; many short ones mean the
    // run had more work than the deadline allows (a wide cache miss).
    if (child.pid !== undefined) {
      console.error(describeRunningTasks(child.pid, REPO_ROOT));
    }
    console.error(
      'turbo-ci-run: tasks that finished before the kill are cached, so a ' +
        'rerun resumes from here. Fix a wedged task, or raise the deadline in ' +
        'libs/tools/scripts/check-budget.ts with the measurement.'
    );
    killTree(child, 'SIGKILL');
  }, deadlineSeconds * 1000);
  return () => {
    clearTimeout(timer);
    process.off('SIGINT', onInt);
    process.off('SIGTERM', onTerm);
  };
}

/** Run turbo to completion or until the deadline. */
function runTurbo(
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  options: RunTurboOptions
): Promise<number> {
  const child = spawn('turbo', args, {
    stdio: 'inherit',
    env,
    detached: true,
  });
  const disarm = armDeadline(child, options.deadlineSeconds);
  return new Promise<number>((resolve) => {
    child.on('close', (code, signal) => {
      disarm();
      resolve(code ?? (signal === null ? 1 : 124));
    });
  });
}

if (import.meta.main) {
  await main();
}
