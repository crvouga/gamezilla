#!/usr/bin/env bun
// @io-wall-ok — composition root
/**
 * Lints `.depot/workflows/**` (actionlint, which also runs shellcheck on
 * `run:`). `mise exec` runs the version pinned in `mise.toml`, installing it
 * on first use.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../../..');

const workflows = readdirSync(join(REPO_ROOT, '.depot/workflows'))
  .filter((file) => /\.ya?ml$/.test(file))
  .map((file) => `.depot/workflows/${file}`);
if (workflows.length === 0) throw new Error('No native CI workflows found');
const result = spawnSync(
  'mise',
  [
    'exec',
    '--',
    'actionlint',
    '-color',
    '-config-file',
    '.github/actionlint.yaml',
    ...workflows,
  ],
  {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  }
);
if (result.error !== undefined) {
  console.error(`check:actionlint: ${result.error.message} — install mise`);
}
process.exit(result.status ?? 1);
