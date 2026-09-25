#!/usr/bin/env bun
// @io-wall-ok — composition root
/**
 * Lints `.github/workflows/**` (actionlint, which also runs shellcheck on
 * `run:`). `mise exec` runs the version pinned in `mise.toml`, installing it
 * on first use.
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../../..');

const result = spawnSync('mise', ['exec', '--', 'actionlint', '-color'], {
  cwd: REPO_ROOT,
  stdio: 'inherit',
});
if (result.error !== undefined) {
  console.error(`check:actionlint: ${result.error.message} — install mise`);
}
process.exit(result.status ?? 1);
