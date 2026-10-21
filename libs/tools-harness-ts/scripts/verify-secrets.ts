#!/usr/bin/env bun
// @io-wall-ok — composition root
/**
 * Secret scan for the commits this change adds (gitleaks, `.gitleaks.toml`).
 * The range comes from `turbo-ci-run` as `VERIFY_SECRETS_RANGE` — the task's
 * only commit-dependent cache key — and is resolved here when run directly.
 * `mise exec` runs the gitleaks pinned in `mise.toml`, installing it on first
 * use.
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { SECRETS_RANGE_ENV, secretsScanRange } from './secrets-scan-range';

const REPO_ROOT = join(import.meta.dirname, '../../..');

const range =
  process.env[SECRETS_RANGE_ENV]?.trim() || secretsScanRange(process.env);

console.log(`gitleaks: scanning ${range}`);

const result = spawnSync(
  'mise',
  [
    'exec',
    '--',
    'gitleaks',
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
