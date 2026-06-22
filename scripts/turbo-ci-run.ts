/**
 * Shared Turbo flags for `check:ci` — keeps cache HTTP under Vercel's rate
 * limit and avoids noisy 429 warnings on local runs.
 *
 * - CI always uses `local:rw,remote:rw`.
 * - Local runs under Vault (`TURBO_CACHE=remote:rw`) honor that env var so
 *   cache uploads work and Turbo does not warn about a read-only remote.
 * - Local runs without Vault fall back to `remote:r` (read hits only).
 */
import { spawnSync } from 'node:child_process';

const TURBO_CACHE_RE = /^(local|remote):(r|rw|w)?(,(local|remote):(r|rw|w)?)?$/;

function inCi(): boolean {
  return process.env.GITHUB_ACTIONS === 'true' || process.env.CI === 'true';
}

function resolveCacheFlag(): string {
  if (inCi()) return 'local:rw,remote:rw';

  const fromEnv = process.env.TURBO_CACHE?.trim();
  if (
    fromEnv !== undefined &&
    fromEnv.length > 0 &&
    TURBO_CACHE_RE.test(fromEnv)
  ) {
    if (fromEnv.includes(',')) return fromEnv;
    if (fromEnv.startsWith('remote:')) return `local:rw,${fromEnv}`;
    if (fromEnv.startsWith('local:')) return `${fromEnv},remote:rw`;
    return fromEnv;
  }

  return 'local:rw,remote:r';
}

const cache = resolveCacheFlag();

const TURBO_OUTPUT_LOGS =
  process.env.TURBO_OUTPUT_LOGS?.trim() || 'hash-only';

const TURBO_CI_FLAGS = [
  '--concurrency=6',
  '--cache-workers=1',
  `--cache=${cache}`,
  '--summarize',
  `--output-logs=${TURBO_OUTPUT_LOGS}`,
  '--log-order=grouped',
] as const;

const taskArgs = process.argv.slice(2);
if (taskArgs.length === 0) {
  console.error('usage: bun run scripts/turbo-ci-run.ts <turbo run args…>');
  process.exit(1);
}

const result = spawnSync('turbo', ['run', ...taskArgs, ...TURBO_CI_FLAGS], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
