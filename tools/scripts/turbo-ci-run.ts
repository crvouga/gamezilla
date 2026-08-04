/**
 * Shared Turbo flags for CI / `check:ci*`.
 *
 * - CI: `local:rw,remote:rw` when `TURBO_TOKEN` + `TURBO_TEAM` are present
 *   (injected by secrets-auth); otherwise `local:rw`. Local disk under
 *   `.turbo` is persisted via per-job `actions/cache`; remote is Vercel.
 * - Local: honor `TURBO_CACHE` when set; otherwise `local:rw` only.
 *   Remote is opt-in (`remote:r` / `remote:rw`) so a rate-limited
 *   Vercel Remote Cache cannot spam `429` into every local check.
 * - Unsets orphan `TURBO_API` so a leftover self-hosted origin cannot
 *   override Vercel's default cache endpoint for local remote use.
 * - Optional `TURBO_AFFECTED_BASE` (git ref/SHA) adds
 *   `--filter=...[<base>]` for PR affected-package runs.
 */
import { spawnSync } from 'node:child_process';

const TURBO_CACHE_RE = /^(local|remote):(r|rw|w)?(,(local|remote):(r|rw|w)?)?$/;

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

function resolveCacheFlag(env: NodeJS.ProcessEnv): string {
  if (inCi()) {
    return hasRemoteCreds(env) ? 'local:rw,remote:rw' : 'local:rw';
  }

  const fromEnv = env['TURBO_CACHE']?.trim();
  if (
    fromEnv !== undefined &&
    fromEnv.length > 0 &&
    TURBO_CACHE_RE.test(fromEnv)
  ) {
    if (fromEnv.includes(',')) return fromEnv;
    if (fromEnv.startsWith('remote:')) return `local:rw,${fromEnv}`;
    return fromEnv;
  }

  return 'local:rw';
}

function turboChildEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  const orphan = env['TURBO_API'];
  if (typeof orphan === 'string' && orphan.trim().length > 0) {
    console.warn(
      'turbo-ci-run: ignoring orphan TURBO_API (set TURBO_CACHE=remote:rw to use Vercel Remote Cache)'
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
  return [`--filter=...[${base}]`];
}

const env = turboChildEnv();
const cache = resolveCacheFlag(env);

const TURBO_OUTPUT_LOGS =
  process.env['TURBO_OUTPUT_LOGS']?.trim() ||
  (inCi() ? 'hash-only' : 'new-only');

const TURBO_CI_FLAGS = [
  '--concurrency=100%',
  '--cache-workers=4',
  `--cache=${cache}`,
  '--summarize',
  `--output-logs=${TURBO_OUTPUT_LOGS}`,
  '--log-order=grouped',
] as const;

const taskArgs = process.argv.slice(2);
if (taskArgs.length === 0) {
  console.error(
    'usage: bun run tools/scripts/turbo-ci-run.ts <turbo run args…>'
  );
  process.exit(1);
}

const affected = resolveAffectedFilter(taskArgs);
if (affected.length > 0) {
  console.log(`turbo-ci-run: affected filter ${affected.join(' ')}`);
}
if (inCi()) {
  console.log(
    `turbo-ci-run: cache=${cache}` +
      (hasRemoteCreds(env) ? ' (remote creds present)' : ' (local only)')
  );
}

const result = spawnSync(
  'turbo',
  ['run', ...taskArgs, ...affected, ...TURBO_CI_FLAGS],
  {
    stdio: 'inherit',
    env,
  }
);

process.exit(result.status ?? 1);
