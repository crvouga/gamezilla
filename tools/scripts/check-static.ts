#!/usr/bin/env bun
// @io-wall-ok — tools composition root
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ensureActionlint } from './cli-deps/actionlint';
import { ensureGitleaks } from './cli-deps/gitleaks';

const REPO_ROOT = join(import.meta.dirname, '../..');
const WORKFLOWS_DIR = join(REPO_ROOT, '.github', 'workflows');
const hasWorkflows = existsSync(WORKFLOWS_DIR);
const LOCAL_BIN = join(homedir(), '.local', 'bin');

function run(cmd: string, args: string[], env?: NodeJS.ProcessEnv): void {
  const result = spawnSync(cmd, args, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: env ?? process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function pathWithLocalBin(): NodeJS.ProcessEnv {
  const path = process.env['PATH'] ?? '';
  const prefix = `${LOCAL_BIN}:`;
  return path.includes(LOCAL_BIN)
    ? { ...process.env }
    : { ...process.env, PATH: `${prefix}${path}` };
}

if (hasWorkflows) {
  await ensureActionlint();
}
await ensureGitleaks();

const env = pathWithLocalBin();

if (hasWorkflows) {
  run('actionlint', ['-color'], env);
} else {
  console.log('Skipping actionlint: no .github/workflows directory');
}

const ghEvent =
  process.env['GH_EVENT'] ?? process.env['GITHUB_EVENT_NAME'] ?? '';
const prBase = process.env['PR_BASE'] ?? '';
const prHead = process.env['PR_HEAD'] ?? '';
const logOpts =
  ghEvent === 'pull_request' && prBase && prHead
    ? `${prBase}..${prHead}`
    : '-1';

run(
  'gitleaks',
  [
    'detect',
    '--redact',
    '--verbose',
    '--no-banner',
    '--exit-code',
    '1',
    `--log-opts=${logOpts}`,
  ],
  env
);
