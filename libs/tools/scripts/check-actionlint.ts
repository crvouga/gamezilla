#!/usr/bin/env bun
// @io-wall-ok — composition root
/** Lints `.github/workflows/**` (actionlint, which also runs shellcheck on `run:`). */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { ensureActionlint } from './cli-deps/actionlint';

const REPO_ROOT = join(import.meta.dirname, '../../..');

await ensureActionlint();
const result = spawnSync('actionlint', ['-color'], {
  cwd: REPO_ROOT,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
