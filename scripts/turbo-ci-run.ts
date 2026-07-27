/**
 * Shared Turbo flags for `check:ci`.
 *
 * - CI: `local:rw,remote:rw` — L1 disk + Vercel Remote Cache.
 * - Local: honor `TURBO_CACHE` when set; otherwise `local:rw,remote:r`.
 * - `--cache-workers=1` serializes remote HTTP (avoids stampedes and keeps
 *   us clear of Vercel's rate limits).
 * - Unsets orphan `TURBO_API` so a leftover self-hosted origin cannot override
 *   Vercel's default cache endpoint.
 *
 * GitHub Actions also restores `.turbo` via `actions/cache` as an L1 layer.
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

const cache = resolveCacheFlag();

const TURBO_OUTPUT_LOGS =
  process.env.TURBO_OUTPUT_LOGS?.trim() || (inCi() ? 'hash-only' : 'new-only');

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
  env: turboChildEnv(),
});

process.exit(result.status ?? 1);
