#!/usr/bin/env bun
// @io-wall-ok — composition root
/**
 * Security audit of `.github/` (zizmor, `.github/zizmor.yml`): workflow and
 * action findings such as unpinned or impostor actions, template injection,
 * persisted checkout credentials, excessive permissions and dangerous
 * triggers. The repository is public, so every pull request is untrusted.
 * Offline: a gate never touches the outside world. Resolve the pinned
 * executable explicitly: PATH may shadow it inside `mise exec`.
 */
import { spawnSync } from 'node:child_process';
import { isAbsolute, join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../../..');

const selected = spawnSync('mise', ['which', 'zizmor'], {
  cwd: REPO_ROOT,
  encoding: 'utf8',
});
if (selected.error !== undefined || selected.status !== 0) {
  console.error(
    `verify:workflow-security: cannot resolve the pinned tool: ${selected.error?.message ?? selected.stderr.trim()}`
  );
  process.exit(selected.status ?? 1);
}
const executable = selected.stdout.trim();
if (!isAbsolute(executable)) {
  console.error(
    'verify:workflow-security: mise did not select an absolute executable'
  );
  process.exit(1);
}
const result = spawnSync(
  executable,
  [
    '--offline',
    '--no-progress',
    '--persona',
    'auditor',
    '--config',
    '.github/zizmor.yml',
    '.github/',
  ],
  { cwd: REPO_ROOT, stdio: 'inherit' }
);
if (result.error !== undefined) {
  console.error(
    `verify:workflow-security: ${result.error.message} — run mise install`
  );
}
process.exit(result.status ?? 1);
