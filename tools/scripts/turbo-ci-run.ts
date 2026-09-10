/**
 * Shared Turbo flags for CI / `check:ci*` / local `check` / `deploy`.
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
 * - Concurrency: honor `TURBO_CONCURRENCY`; otherwise
 *   `min(8, max(cpus, 4))` locally. In CI the floor is 2 so a 2-core /
 *   7GB GitHub-hosted runner does not launch 10 Node heaps.
 * - Log order: `auto` locally; `stream` in CI (not `grouped` — grouped holds
 *   task stdout until completion, which looks like a hang). Override with
 *   `TURBO_LOG_ORDER`. `check` / `check:full` (and `//#…` forms) are expanded
 *   recursively to leaf `dependsOn` tasks so turbo never nests under a root
 *   `check` script (would recurse).
 * - Output logs: `new-only` (cache misses stream). Override with
 *   `TURBO_OUTPUT_LOGS`. Do not default CI to `errors-only`: a silent pipe is
 *   SIGTERM'd (~10 min, exit 143) by GitHub Actions.
 * - UI: turbo ignores a `TURBO_UI` env var — pass `--ui=tui|stream` via
 *   `TURBO_UI` here (CI sets `stream`; local `deploy:*` sets `tui`).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';

import { killOrphanEsbuildServices } from '@pkgs/os/kill-orphan-esbuild';

import {
  CHECK_SECRETS_FINGERPRINT_ENV,
  computeCheckSecretsFingerprint,
} from '../../libs/secrets/src/shared/secrets/check-secrets-fingerprint';
import { DEFAULT_TURBO_API } from '../../libs/secrets/src/shared/secrets/turbo-token';

const REPO_ROOT = join(import.meta.dirname, '../..');
const CHECK_AGGREGATOR = '//#check';
const CHECK_FULL_AGGREGATOR = '//#check:full';
const SECRETS_CHECK_TASK = '@libs/secrets#check';
const DEPLOY_TASK = 'deploy';

/** Root-package script names and turbo root-task aliases that are aggregators. */
const AGGREGATOR_ALIASES: ReadonlyMap<string, string> = new Map([
  ['check', CHECK_AGGREGATOR],
  ['//#check', CHECK_AGGREGATOR],
  ['//:check', CHECK_AGGREGATOR],
  ['check:full', CHECK_FULL_AGGREGATOR],
  ['//#check:full', CHECK_FULL_AGGREGATOR],
  ['//:check:full', CHECK_FULL_AGGREGATOR],
]);

const TURBO_CACHE_RE = /^(local|remote):(r|rw|w)?(,(local|remote):(r|rw|w)?)?$/;
const TURBO_UI_VALUES = new Set(['tui', 'stream']);
const DEFAULT_CACHE = 'local:rw,remote:rw';
const LOCAL_ONLY_CACHE = 'local:rw';
const MAX_CHECK_CONCURRENCY = 8;
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
  return String(Math.min(MAX_CHECK_CONCURRENCY, Math.max(cpus, min)));
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
 * Recursively expand check / check:full aggregators to leaf turbo tasks.
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
    const canonical = AGGREGATOR_ALIASES.get(arg);
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
      `turbo-ci-run: expanded check aggregators to ${String(out.length)} leaf tasks`
    );
  }
  return out;
}

function needsSecretsFingerprint(taskArgs: readonly string[]): boolean {
  return taskArgs.some(
    (arg) => arg === SECRETS_CHECK_TASK || arg === DEPLOY_TASK
  );
}

async function ensureSecretsFingerprint(
  env: NodeJS.ProcessEnv,
  taskArgs: readonly string[]
): Promise<void> {
  if (!needsSecretsFingerprint(taskArgs)) return;
  console.log('turbo-ci-run: computing secrets fingerprint (Infisical)…');
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
      'Run `infisical login` so local warms upload to the self-hosted Turbo remote cache.'
  );
}

function applyOfflineTaskArgs(
  taskArgs: readonly string[],
  hasRemote: boolean
): string[] {
  if (hasRemote) return [...taskArgs];
  if (taskArgs.includes(DEPLOY_TASK)) {
    console.error(
      'turbo-ci-run: deploy requires TURBO_TOKEN and TURBO_TEAM from Infisical. ' +
        'Run `infisical login` then retry via secrets-run.'
    );
    process.exit(1);
  }
  if (!taskArgs.includes(SECRETS_CHECK_TASK)) return [...taskArgs];
  console.warn(
    'turbo-ci-run: skipping @libs/secrets#check (Infisical unavailable).'
  );
  return taskArgs.filter((arg) => arg !== SECRETS_CHECK_TASK);
}

async function main(): Promise<void> {
  const env = turboChildEnv();
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
      'usage: bun run tools/scripts/turbo-ci-run.ts <turbo run args…>'
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
      '--filter=./pkgs/*',
      '--filter=./tools'
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
