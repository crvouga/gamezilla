#!/usr/bin/env bun
// @io-wall-ok — composition root
/**
 * Lints `.github/workflows/**` (actionlint, which also runs shellcheck on
 * `run:`). Workspace/CI setup installs the tools pinned in `mise.toml`.
 * Resolve the executable explicitly: PATH may shadow it inside `mise exec`.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../../..');

const workflows = readdirSync(join(REPO_ROOT, '.github/workflows'))
  .filter((file) => /\.ya?ml$/.test(file))
  .map((file) => `.github/workflows/${file}`);
if (workflows.length === 0) throw new Error('No native CI workflows found');
const selected = spawnSync('mise', ['which', 'actionlint'], {
  cwd: REPO_ROOT,
  encoding: 'utf8',
});
if (selected.error !== undefined || selected.status !== 0) {
  console.error(
    `verify:actionlint: cannot resolve the pinned tool: ${selected.error?.message ?? selected.stderr.trim()}`
  );
  process.exit(selected.status ?? 1);
}
const executable = selected.stdout.trim();
if (!isAbsolute(executable)) {
  console.error(
    'verify:actionlint: mise did not select an absolute executable'
  );
  process.exit(1);
}
const result = spawnSync(
  executable,
  ['-color', '-config-file', '.github/actionlint.yaml', ...workflows],
  {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  }
);
if (result.error !== undefined) {
  console.error(
    `verify:actionlint: ${result.error.message} — run mise install`
  );
}
process.exit(result.status ?? 1);
