/**
 * Shared Turbo flags for `check:ci`.
 *
 * Cache is local-only. In GitHub Actions, `actions/cache` restores/saves
 * `.turbo` across runs so we get cross-PR hits without Vercel Remote Cache
 * (and without its rate limits).
 */
import { spawnSync } from 'node:child_process';

function inCi(): boolean {
  return process.env.GITHUB_ACTIONS === 'true' || process.env.CI === 'true';
}

const TURBO_OUTPUT_LOGS =
  process.env.TURBO_OUTPUT_LOGS?.trim() || (inCi() ? 'hash-only' : 'new-only');

const TURBO_CI_FLAGS = [
  '--concurrency=6',
  '--cache=local:rw',
  '--summarize',
  `--output-logs=${TURBO_OUTPUT_LOGS}`,
  '--log-order=grouped',
] as const;

const taskArgs = process.argv.slice(2);
if (taskArgs.length === 0) {
  console.error('usage: bun run scripts/turbo-ci-run.ts <turbo run args…>');
  process.exit(1);
}

const env = { ...process.env };
delete env.TURBO_TOKEN;
delete env.TURBO_TEAM;
delete env.TURBO_API;
delete env.TURBO_CACHE;

const result = spawnSync('turbo', ['run', ...taskArgs, ...TURBO_CI_FLAGS], {
  stdio: 'inherit',
  env,
});

process.exit(result.status ?? 1);
