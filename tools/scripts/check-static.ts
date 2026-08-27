#!/usr/bin/env bun
// @io-wall-ok — tools composition root
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ensureActionlint } from './cli-deps/actionlint';
import { ensureGitleaks } from './cli-deps/gitleaks';

const REPO_ROOT = join(import.meta.dirname, '../..');
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

await ensureActionlint();
await ensureGitleaks();

const env = pathWithLocalBin();

run('actionlint', ['-color'], env);

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
