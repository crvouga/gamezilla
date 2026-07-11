/**
 * Shared Turbo flags for `check:ci` — keeps cache HTTP under Vercel's rate
 * limit and avoids noisy 429 warnings on local runs.
 *
 * - CI always uses `local:rw,remote:rw`.
 * - Local runs always use `local:rw,remote:r` (read hits only; no write
 *   permission required). `TURBO_CACHE=remote:rw` in Infisical applies to CI.
 */
import { spawnSync } from 'node:child_process';

function inCi(): boolean {
  return process.env.GITHUB_ACTIONS === 'true' || process.env.CI === 'true';
}

function resolveCacheFlag(): string {
  if (inCi()) return 'local:rw,remote:rw';
  return 'local:rw,remote:r';
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
  env: process.env,
});

process.exit(result.status ?? 1);
