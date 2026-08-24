/**
 * Shared Turbo flags for CI / `check:ci*` / local `check` / `deploy`.
 *
 * - Cache is always `local:rw,remote:rw` (Vercel Remote Cache). Local disk
 *   under `.turbo` is also persisted in CI via per-job `actions/cache`.
 *   `TURBO_CACHE` may tighten local/remote modes but cannot drop `remote:`.
 * - Requires `TURBO_TOKEN` + `TURBO_TEAM` so local warms upload and CI
 *   reuses the same remote artifacts.
 * - Disables framework inference so only explicit `turbo.json` `env` /
 *   `globalEnv` enter the hash (avoids Expo `EXPO_PUBLIC_*` skew).
 * - Unsets orphan `TURBO_API` so a leftover self-hosted origin cannot
 *   override Vercel's default cache endpoint.
 * - Optional `TURBO_AFFECTED_BASE` (git ref/SHA) adds
 *   `--filter=...[<base>] --filter=//` so PR runs skip unchanged
 *   packages but still execute named root tasks (`ci:depcruise`).
 * - Concurrency: honor `TURBO_CONCURRENCY`; otherwise
 *   `min(32, max(cpus * 2, 10))`.
 * - Log order: `auto` locally (turbo streams); `grouped` in CI. Override with
 *   `TURBO_LOG_ORDER`. `//#check` in argv is expanded to its `dependsOn` ci
 *   tasks so turbo does not nest them under a `//:check` prefix (stream mode
 *   stacks prefixes on nested umbrella tasks).
 * - Output logs: `errors-only` in CI (failed task stderr in the job log /
 *   LLM fix prompt); `new-only` locally. Override with `TURBO_OUTPUT_LOGS`.
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

const REPO_ROOT = join(import.meta.dirname, '../..');
const CHECK_AGGREGATOR = '//#check';
const SECRETS_CHECK_TASK = '@libs/secrets#check';
const DEPLOY_TASK = 'deploy';

const TURBO_CACHE_RE = /^(local|remote):(r|rw|w)?(,(local|remote):(r|rw|w)?)?$/;
const TURBO_UI_VALUES = new Set(['tui', 'stream']);
const DEFAULT_CACHE = 'local:rw,remote:rw';
const MAX_CHECK_CONCURRENCY = 32;
const MIN_CHECK_CONCURRENCY = 10;
const CACHE_WORKERS = 16;

function inCi(): boolean {
  return (
    process.env['GITHUB_ACTIONS'] === 'true' || process.env['CI'] === 'true'
  );
}

function hasRemoteCreds(env: NodeJS.ProcessEnv): boolean {
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

function resolveCacheFlag(env: NodeJS.ProcessEnv): string {
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
  return String(
    Math.min(MAX_CHECK_CONCURRENCY, Math.max(cpus * 2, MIN_CHECK_CONCURRENCY))
  );
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

function turboChildEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  const orphan = env['TURBO_API'];
  if (typeof orphan === 'string' && orphan.trim().length > 0) {
    console.warn(
      'turbo-ci-run: ignoring orphan TURBO_API (Vercel Remote Cache is the default)'
    );
  }
  delete env['TURBO_API'];
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

function loadCheckCiTasks(): string[] {
  const turboJson = JSON.parse(
    readFileSync(join(REPO_ROOT, 'turbo.json'), 'utf8')
  ) as {
    tasks?: Record<string, { dependsOn?: unknown }>;
  };
  const deps = turboJson.tasks?.[CHECK_AGGREGATOR]?.dependsOn;
  if (!Array.isArray(deps)) {
    throw new Error(`turbo.json missing ${CHECK_AGGREGATOR} dependsOn`);
  }
  return deps.filter((dep): dep is string => typeof dep === 'string');
}

function isCheckAggregator(arg: string): boolean {
  return arg === CHECK_AGGREGATOR || arg === '//:check';
}

/** Flatten `//#check` so ci gates are root turbo tasks (avoids nested log prefixes). */
function flattenCheckAggregator(taskArgs: readonly string[]): string[] {
  const ciTasks = loadCheckCiTasks();
  const out: string[] = [];
  let expanded = false;
  for (const arg of taskArgs) {
    if (isCheckAggregator(arg)) {
      expanded = true;
      out.push(...ciTasks);
    } else {
      out.push(arg);
    }
  }
  if (expanded) {
    console.log(
      `turbo-ci-run: expanded ${CHECK_AGGREGATOR} to ${String(ciTasks.length)} root ci tasks`
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

async function main(): Promise<void> {
  const env = turboChildEnv();
  if (!hasRemoteCreds(env)) {
    console.error(
      'turbo-ci-run: TURBO_TOKEN and TURBO_TEAM are required for Vercel Remote Cache. ' +
        'Run via secrets-run / secrets-auth (Infisical) so local warms upload and CI reuses them.'
    );
    process.exit(1);
  }

  const cache = resolveCacheFlag(env);
  const concurrency = resolveConcurrency();
  const TURBO_OUTPUT_LOGS =
    process.env['TURBO_OUTPUT_LOGS']?.trim() ||
    (inCi() ? 'errors-only' : 'new-only');
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
      'usage: bun run tools/scripts/turbo-ci-run.ts <turbo run args…>'
    );
    process.exit(1);
  }

  const taskArgs = flattenCheckAggregator(rawTaskArgs);
  await ensureSecretsFingerprint(env, taskArgs);

  const affected = resolveAffectedFilter(taskArgs);
  if (affected.length > 0) {
    console.log(`turbo-ci-run: affected filter ${affected.join(' ')}`);
  }
  console.log(
    `turbo-ci-run: cache=${cache} concurrency=${concurrency} log-order=${TURBO_LOG_ORDER}` +
      (ui !== undefined ? ` ui=${ui}` : '') +
      ' (remote creds present)'
  );

  const result = spawnSync(
    'turbo',
    ['run', ...taskArgs, ...affected, ...TURBO_CI_FLAGS],
    {
      stdio: 'inherit',
      env,
    }
  );

  // Reap any esbuild --service workers orphaned by force-exited tasks.
  killOrphanEsbuildServices({ commandIncludes: REPO_ROOT });
  process.exit(result.status ?? 1);
}

await main();
