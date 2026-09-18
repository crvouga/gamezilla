/**
 * Shared Turbo flags for CI / local `check` / `deploy`.
 *
 * - Cache is `local:rw,remote:rw` (self-hosted remote at
 *   `https://turborepo.chrisvouga.dev`) when `TURBO_TOKEN` + `TURBO_TEAM` are
 *   present. Local disk under `.turbo` is also persisted in CI via per-job
 *   `actions/cache`. `TURBO_CACHE` may tighten local/remote modes but cannot
 *   drop `remote:` when creds are present.
 * - CI requires `TURBO_TOKEN` + `TURBO_TEAM`. Locally, missing creds (Infisical
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
 * - Log order: `auto` locally; `stream` in CI (not `grouped` — grouped holds
 *   task stdout until completion, which looks like a hang). Override with
 *   `TURBO_LOG_ORDER`. `check` / `deploy` (and `//#…` forms) are expanded
 *   recursively to leaf `dependsOn` tasks so turbo never nests under a root
 *   aggregator script (would recurse).
 * - Output logs: `new-only` (cache misses stream). Override with
 *   `TURBO_OUTPUT_LOGS`. Do not default CI to `errors-only`: a silent pipe is
 *   SIGTERM'd (~10 min, exit 143) by GitHub Actions.
 * - UI: turbo ignores a `TURBO_UI` env var — pass `--ui=tui|stream` via
 *   `TURBO_UI` here (CI sets `stream`; local `deploy:*` sets `tui`).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import {
  CHECK_SECRETS_FINGERPRINT_ENV,
  computeCheckSecretsFingerprint,
} from '@libs/secrets/shared/secrets/check-secrets-fingerprint';
import { DEFAULT_TURBO_API } from '@libs/secrets/shared/secrets/turbo-token';
import { killOrphanEsbuildServices } from '@pkgs/os/kill-orphan-esbuild';

const REPO_ROOT = join(import.meta.dirname, '../../..');
const CHECK_AGGREGATOR = '//#check';
const DEPLOY_AGGREGATOR = '//#deploy';
const SECRETS_CHECK_TASK = '@libs/secrets#check';
const SMOKE_TASK = '@apps/server#smoke';

const PLATFORM_KEY_PATH = join(REPO_ROOT, 'turbo-platform-key.json');

/**
 * Turborepo's hash knows nothing about the platform
 * (https://turborepo.dev/docs/guides/handling-platforms), so a macOS result
 * could satisfy a Linux run. The platform-scoped leaves — `test:e2e` (real
 * browser engine) and `test:contract` (embedded Postgres / MinIO / EMQX
 * binaries) — declare this file as an input, so their caches are per-platform
 * while everything portable (tc, lint, unit tests) still shares one cache
 * across machines. Written on every run: absent (a bare `turbo run`) hashes
 * differently, which costs a cache miss, never correctness.
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

function inCi(): boolean {
  return (
    process.env['GITHUB_ACTIONS'] === 'true' || process.env['CI'] === 'true'
  );
}

export function hasRemoteCreds(env: NodeJS.ProcessEnv): boolean {
  const token = env['TURBO_TOKEN']?.trim();
  const team = env['TURBO_TEAM']?.trim();
  return (
    token !== undefined &&
    token.length > 0 &&
    team !== undefined &&
    team.length > 0
  );
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

/** Pass through / default `TURBO_API` for self-hosted remote cache. */
export function turboChildEnv(
  source: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...source };
  const api = env['TURBO_API']?.trim();
  if (api !== undefined && api.length > 0) {
    env['TURBO_API'] = api.replace(/\/+$/, '');
    return env;
  }
  if (hasRemoteCreds(env)) {
    env['TURBO_API'] = DEFAULT_TURBO_API;
  }
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
    'turbo-ci-run: TURBO_TOKEN and TURBO_TEAM are required for self-hosted Turbo remote cache. ' +
      'Run via secrets-run / secrets-auth (Infisical) so local warms upload and CI reuses them.'
  );
  process.exit(1);
}

function warnLocalCacheOnly(hasRemote: boolean): void {
  if (hasRemote) return;
  console.warn(
    'turbo-ci-run: TURBO_TOKEN and TURBO_TEAM missing; using local cache only. ' +
      'Run `bun run secrets:pull` so local warms upload to the self-hosted Turbo remote cache.'
  );
}

function applyOfflineTaskArgs(
  taskArgs: readonly string[],
  hasRemote: boolean
): string[] {
  if (hasRemote) return [...taskArgs];
  if (isDeployLeafSet(taskArgs)) {
    console.error(
      'turbo-ci-run: deploy requires TURBO_TOKEN and TURBO_TEAM. ' +
        'Run `bun run secrets:pull` then retry via secrets-run.'
    );
    process.exit(1);
  }
  if (!taskArgs.includes(SECRETS_CHECK_TASK)) return [...taskArgs];
  console.warn(
    'turbo-ci-run: skipping @libs/secrets#check (no Turbo remote creds; run `bun run secrets:pull`).'
  );
  return taskArgs.filter((arg) => arg !== SECRETS_CHECK_TASK);
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
    process.env['TURBO_LOG_ORDER']?.trim() || (inCi() ? 'stream' : 'auto');
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

  const taskArgs = applyOfflineTaskArgs(
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

  console.log(
    `turbo-ci-run: cache=${cache} concurrency=${concurrency} log-order=${TURBO_LOG_ORDER}` +
      (ui !== undefined ? ` ui=${ui}` : '') +
      (remote
        ? ` (remote creds present; api=${env['TURBO_API'] ?? DEFAULT_TURBO_API})`
        : ' (local cache only)')
  );

  const result = spawnSync(
    'turbo',
    ['run', ...taskArgs, ...affected, ...rootExcludeFilters, ...TURBO_CI_FLAGS],
    {
      stdio: 'inherit',
      env,
    }
  );

  // Reap any esbuild --service workers orphaned by force-exited tasks.
  killOrphanEsbuildServices({ commandIncludes: REPO_ROOT });
  process.exit(result.status ?? 1);
}

if (import.meta.main) {
  await main();
}
