#!/usr/bin/env bun
// @io-wall-ok — composition root
/**
 * Secret scan for the commits this change adds (gitleaks, `.gitleaks.toml`).
 * The range comes from `turbo-ci-run` as `CHECK_SECRETS_RANGE` — the task's
 * only commit-dependent cache key — and is resolved here when run directly.
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { ensureGitleaks } from './cli-deps/gitleaks';
import { SECRETS_RANGE_ENV, secretsScanRange } from './secrets-scan-range';

const REPO_ROOT = join(import.meta.dirname, '../../..');

const range =
  process.env[SECRETS_RANGE_ENV]?.trim() || secretsScanRange(process.env);

await ensureGitleaks();
console.log(`gitleaks: scanning ${range}`);

const result = spawnSync(
  'gitleaks',
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
process.exit(result.status ?? 1);
