/**
 * Shared Turbo flags for `check:ci` — keeps cache HTTP under Vercel's rate
 * limit and avoids noisy 429 warnings on local runs.
 *
 * - `--cache-workers=1` serializes artifact uploads (see AGENTS.md).
 * - Local dev uses `remote:r` (read hits, skip uploads); CI uses `remote:rw`.
 */
import { spawnSync } from 'node:child_process';

function inCi(): boolean {
  return process.env.GITHUB_ACTIONS === 'true' || process.env.CI === 'true';
}

const cache = inCi() ? 'local:rw,remote:rw' : 'local:rw,remote:r';

const TURBO_CI_FLAGS = [
  '--concurrency=6',
  '--cache-workers=1',
  `--cache=${cache}`,
  '--summarize',
  '--output-logs=hash-only',
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
