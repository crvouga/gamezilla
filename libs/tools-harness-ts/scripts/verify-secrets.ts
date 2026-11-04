#!/usr/bin/env bun
// @io-wall-ok — composition root
/**
 * Secret scan for the commits this change adds (gitleaks, `.gitleaks.toml`).
 * The range comes from `turbo-ci-run` as `VERIFY_SECRETS_RANGE` — the task's
 * only commit-dependent cache key — and is resolved here when run directly.
 * Setup installs the pinned scanner. Verification resolves it without
 * installing tools or making toolchain API requests.
 */
import { spawnSync } from 'node:child_process';
import { isAbsolute, join } from 'node:path';
import { SECRETS_RANGE_ENV, secretsScanRange } from './secrets-scan-range';

const REPO_ROOT = join(import.meta.dirname, '../../..');

const range =
  process.env[SECRETS_RANGE_ENV]?.trim() || secretsScanRange(process.env);

console.log(`gitleaks: scanning ${range}`);

const selected = spawnSync('mise', ['which', 'gitleaks'], {
  cwd: REPO_ROOT,
  encoding: 'utf8',
});
if (selected.error !== undefined || selected.status !== 0) {
  console.error(
    `verify:secrets: cannot resolve the pinned scanner: ${selected.error?.message ?? selected.stderr.trim()}`
  );
  process.exit(selected.status ?? 1);
}
const executable = selected.stdout.trim();
if (!isAbsolute(executable)) {
  console.error('verify:secrets: mise did not select an absolute executable');
  process.exit(1);
}

const result = spawnSync(
  executable,
  [
    'git',
    '--redact',
    '--verbose',
    '--no-banner',
    '--exit-code',
    '1',
    `--log-opts=${range}`,
  ],
  { cwd: REPO_ROOT, stdio: 'inherit' }
);
if (result.error !== undefined) {
  console.error(`verify:secrets: ${result.error.message} — install mise`);
}
process.exit(result.status ?? 1);
