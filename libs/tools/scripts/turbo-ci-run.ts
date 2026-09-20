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
 * - Optional `TURBO_AFFECTED_BASE` (git ref/SHA) adds
 *   `--filter=...[<base>] --filter=//` so PR runs skip unchanged
 *   packages but still execute named root tasks (`ci:depcruise`).
 * - Concurrency: honor `TURBO_CONCURRENCY`; otherwise `availableParallelism()`
 *   with a local floor of 4 and a CI floor of 2 (2-core / 7GB runners).
 * - Log order: `auto` locally; `grouped` in CI, which turbo renders as one
 *   collapsible `::group::` per task on GitHub Actions. Grouped holds a task's
 *   output until it finishes, so the workflow step runs a heartbeat. Override
 *   with `TURBO_LOG_ORDER`. On GitHub Actions, groups that only say "cache
 *   hit, suppressing logs" are dropped (`CachedGroupFilter`); turbo's final
 *   `Cached:` line still counts them. `check` / `deploy` (and `//#…` forms) are expanded
 *   recursively to leaf `dependsOn` tasks so turbo never nests under a root
 *   aggregator script (would recurse).
 * - Output logs: `new-only` (cache misses print). Override with
 *   `TURBO_OUTPUT_LOGS`.
 * - UI: turbo ignores a `TURBO_UI` env var — pass `--ui=tui|stream` via
 *   `TURBO_UI` here (CI sets `stream`; local `deploy:*` sets `tui`).
 * - Time limits: the run is killed at a hard wall-clock deadline, and every
 *   task that executed is checked against its per-task budget once the run
 *   finishes. Both live in `check-budget.ts`.
 */
import { type ChildProcess, spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import {
  CHECK_SECRETS_FINGERPRINT_ENV,
  computeCheckSecretsFingerprint,
} from '@libs/secrets/shared/secrets/check-secrets-fingerprint';
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
} from './check-budget';
import { CachedGroupFilter } from './github-cached-group-filter';

const REPO_ROOT = join(import.meta.dirname, '../../..');
const CHECK_AGGREGATOR = '//#check';
const DEPLOY_AGGREGATOR = '//#deploy';
const SECRETS_CHECK_TASK = '@libs/secrets#check';
const SMOKE_TASK = '@apps/server#smoke';

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

function resolveAffectedFilter(taskArgs: readonly string[]): string[] {
  const base = process.env['TURBO_AFFECTED_BASE']?.trim();
  if (base === undefined || base.length === 0) return [];
  const alreadyScm = taskArgs.some(
    (a) => a.startsWith('--filter=') && a.includes('[')
  );
  if (alreadyScm) return [];
  return [`--filter=...[${base}]`, '--filter=//'];
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
  let expandedCount = 0;

  function pushLeaf(leaf: string): void {
    if (seen.has(leaf)) return;
    seen.add(leaf);
    out.push(leaf);
  }

  function expand(arg: string): void {
    const canonical = Object.hasOwn(AGGREGATOR_ALIASES, arg)
      ? AGGREGATOR_ALIASES[arg]
      : undefined;
    if (canonical === undefined) {
      pushLeaf(arg);
      return;
    }
    expandedCount += 1;
    for (const dep of taskDependsOn(tasks, canonical)) {
      expand(dep);
    }
  }

  for (const arg of taskArgs) {
    expand(arg);
  }

  if (expandedCount > 0) {
    console.log(
      `turbo-ci-run: expanded aggregators to ${String(out.length)} leaf tasks`
    );
  }
  return out;
}

function isDeployLeafSet(taskArgs: readonly string[]): boolean {
  return taskArgs.includes(SMOKE_TASK);
}

function needsSecretsFingerprint(taskArgs: readonly string[]): boolean {
  return taskArgs.includes(SECRETS_CHECK_TASK) || isDeployLeafSet(taskArgs);
}

async function ensureSecretsFingerprint(
  env: NodeJS.ProcessEnv,
  taskArgs: readonly string[]
): Promise<void> {
  if (!needsSecretsFingerprint(taskArgs)) return;
  console.log(
    'turbo-ci-run: computing secrets fingerprint (local cache or Infisical)…'
  );
  env[CHECK_SECRETS_FINGERPRINT_ENV] = await computeCheckSecretsFingerprint();
  console.log('turbo-ci-run: secrets fingerprint ready.');
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

type OfflineTaskArgs = {
  readonly taskArgs: readonly string[];
  /** Leaves this machine cannot run; the gate is incomplete without them. */
  readonly skipped: readonly string[];
};

/**
 * Leaves that need real credentials still come out of the set when there are
 * none — running them would only fail at the fingerprint, before any other
 * check got to speak. What must not happen is the run then reporting green:
 * that is the bug where a laptop passes and CI fails on the same commit. The
 * names come back so `main` can fail the run and say which leaves are missing.
 */
function applyOfflineTaskArgs(
  taskArgs: readonly string[],
  hasRemote: boolean
): OfflineTaskArgs {
  if (hasRemote) return { taskArgs: [...taskArgs], skipped: [] };
  if (isDeployLeafSet(taskArgs)) {
    console.error(
      'turbo-ci-run: deploy requires TURBO_TOKEN. ' +
        'Run `bun run secrets:pull` then retry via secrets-run.'
    );
    process.exit(1);
  }
  if (!taskArgs.includes(SECRETS_CHECK_TASK)) {
    return { taskArgs: [...taskArgs], skipped: [] };
  }
  return {
    taskArgs: taskArgs.filter((arg) => arg !== SECRETS_CHECK_TASK),
    skipped: [SECRETS_CHECK_TASK],
  };
}

/** A run that could not execute every leaf is not a green gate. */
function reportIncompleteGate(skipped: readonly string[]): void {
  console.error(
    `turbo-ci-run: gate incomplete — ${String(skipped.length)} leaf(s) could ` +
      `not run on this machine: ${skipped.join(', ')}.\n` +
      'Everything else passed, but this run does not prove the PR check is ' +
      'green, so it does not exit 0. Run `infisical login` then ' +
      '`bun run secrets:pull` to run the whole gate.'
  );
}

async function main(): Promise<void> {
  const env = turboChildEnv();
  writePlatformCacheKey();

  const remote = hasRemoteCreds(env);
  requireRemoteCredsInCi(remote);
  warnLocalCacheOnly(remote);

  const cache = resolveCacheFlag(env, remote);
  const concurrency = resolveConcurrency();
  const TURBO_OUTPUT_LOGS =
    process.env['TURBO_OUTPUT_LOGS']?.trim() || 'new-only';
  const TURBO_LOG_ORDER =
    process.env['TURBO_LOG_ORDER']?.trim() || (inCi() ? 'grouped' : 'auto');
  const ui = resolveUi();

  const TURBO_CI_FLAGS = [
    `--concurrency=${concurrency}`,
    `--cache-workers=${String(CACHE_WORKERS)}`,
    `--cache=${cache}`,
    '--framework-inference=false',
    '--summarize',
    `--output-logs=${TURBO_OUTPUT_LOGS}`,
    `--log-order=${TURBO_LOG_ORDER}`,
    ...(ui !== undefined ? [`--ui=${ui}`] : []),
  ] as const;

  const rawTaskArgs = process.argv.slice(2);
  if (rawTaskArgs.length === 0) {
    console.error(
      'usage: bun run libs/tools/scripts/turbo-ci-run.ts <turbo run args…>'
    );
    process.exit(1);
  }

  const { taskArgs, skipped } = applyOfflineTaskArgs(
    flattenCheckAggregators(rawTaskArgs),
    remote
  );
  await ensureSecretsFingerprint(env, taskArgs);

  const affected = resolveAffectedFilter(taskArgs);
  if (affected.length > 0) {
    console.log(`turbo-ci-run: affected filter ${affected.join(' ')}`);
  }

  // Exclude the root workspace from package tasks so root scripts like
  // `lint` (which themselves call turbo-ci-run) are never scheduled.
  const hasExplicitFilter = taskArgs.some((a) => a.startsWith('--filter='));
  const hasPackageTasks = taskArgs.some(
    (a) => !a.startsWith('//') && !a.startsWith('--')
  );
  const hasRootTasks = taskArgs.some((a) => a.startsWith('//'));
  const rootExcludeFilters: string[] = [];
  if (!hasExplicitFilter && affected.length === 0 && hasPackageTasks) {
    rootExcludeFilters.push(
      '--filter=./apps/*',
      '--filter=./libs/*',
      '--filter=./pkgs/*'
    );
    if (hasRootTasks) {
      rootExcludeFilters.push('--filter=//');
    }
  }

  const slowRunner = inCi();
  const deadlineSeconds = resolveRunDeadlineSeconds(process.env, {
    isDeploy: isDeployLeafSet(taskArgs),
    slowRunner,
  });

  console.log(
    `turbo-ci-run: cache=${cache} concurrency=${concurrency} log-order=${TURBO_LOG_ORDER} deadline=${String(deadlineSeconds)}s` +
      (ui !== undefined ? ` ui=${ui}` : '') +
      (remote
        ? ` (remote creds present; api=${env['TURBO_API'] ?? DEFAULT_TURBO_API})`
        : ' (local cache only)')
  );

  const status = await runTurbo(
    ['run', ...taskArgs, ...affected, ...rootExcludeFilters, ...TURBO_CI_FLAGS],
    env,
    {
      hideCachedGroups: inGithubActions() && ui !== 'tui',
      deadlineSeconds,
    }
  );

  // Reap any esbuild --service workers orphaned by force-exited tasks.
  killOrphanEsbuildServices({ commandIncludes: REPO_ROOT });
  process.exit(finalExitCode({ status, slowRunner, skipped }));
}

/**
 * Zero only when turbo passed, every executed task was inside its budget, and
 * the gate ran end to end. A skipped leaf is not a pass.
 */
function finalExitCode(args: {
  readonly status: number;
  readonly slowRunner: boolean;
  readonly skipped: readonly string[];
}): number {
  if (args.status !== 0) return args.status;
  const budget = enforceTaskBudgets(args.slowRunner);
  if (budget !== 0) return budget;
  if (args.skipped.length === 0) return 0;
  reportIncompleteGate(args.skipped);
  return 1;
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
  const overruns = findBudgetOverruns(summary, slowRunner);
  if (overruns.length === 0) return 0;
  console.error(formatBudgetOverruns(overruns));
  return 1;
}

type RunTurboOptions = {
  readonly hideCachedGroups: boolean;
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
      `turbo-ci-run: hard deadline of ${String(deadlineSeconds)}s reached; killing the run. ` +
        'Find the task that wedged (turbo prints the ones still running), fix it, ' +
        `or raise the deadline in libs/tools/scripts/check-budget.ts.`
    );
    killTree(child, 'SIGKILL');
  }, deadlineSeconds * 1000);
  return () => {
    clearTimeout(timer);
    process.off('SIGINT', onInt);
    process.off('SIGTERM', onTerm);
  };
}

/**
 * Run turbo to completion or until the deadline. With `hideCachedGroups`,
 * stdout goes through `CachedGroupFilter` so the GitHub log keeps only tasks
 * that did work.
 */
async function runTurbo(
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  options: RunTurboOptions
): Promise<number> {
  const child = spawn('turbo', args, {
    stdio: [
      'inherit',
      options.hideCachedGroups ? 'pipe' : 'inherit',
      'inherit',
    ],
    env,
    detached: true,
  });
  const disarm = armDeadline(child, options.deadlineSeconds);
  const exited = new Promise<number>((resolve) => {
    child.on('close', (code, signal) => {
      disarm();
      resolve(code ?? (signal === null ? 1 : 124));
    });
  });
  if (child.stdout === null) return exited;

  const filter = new CachedGroupFilter((line) => {
    process.stdout.write(`${line}\n`);
  });
  for await (const line of createInterface({ input: child.stdout })) {
    filter.push(line);
  }
  filter.end();
  if (filter.hiddenCount > 0) {
    console.log(
      `turbo-ci-run: hid ${String(filter.hiddenCount)} cache-hit task group(s) with no new logs`
    );
  }
  return exited;
}

if (import.meta.main) {
  await main();
}
