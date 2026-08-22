#!/usr/bin/env bun
// @io-wall-ok — tools composition root
import { spawnSync } from 'node:child_process';
import { accessSync, chmodSync, constants } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

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

function ensureActionlint(): void {
  const local = join(REPO_ROOT, 'actionlint');
  try {
    accessSync(local, constants.X_OK);
    run(local, ['-color']);
    return;
  } catch {
    /* install below */
  }

  const plat = process.platform === 'darwin' ? 'darwin' : 'linux';
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
  const version = '1.7.7';
  const asset = `actionlint_${version}_${plat}_${arch}.tar.gz`;
  const url = `https://github.com/rhysd/actionlint/releases/download/v${version}/${asset}`;
  run('curl', ['-fsSL', url, '-o', '/tmp/actionlint.tar.gz']);
  run('tar', ['-xzf', '/tmp/actionlint.tar.gz', '-C', REPO_ROOT, 'actionlint']);
  chmodSync(local, 0o755);
  run(local, ['-color']);
}

ensureActionlint();
run('bun', ['run', 'tools/scripts/install-gitleaks.ts'], pathWithLocalBin());

const ghEvent = process.env['GH_EVENT'] ?? process.env['GITHUB_EVENT_NAME'] ?? '';
const prBase = process.env['PR_BASE'] ?? '';
const prHead = process.env['PR_HEAD'] ?? '';
const logOpts =
  ghEvent === 'pull_request' && prBase && prHead ? `${prBase}..${prHead}` : '-1';

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
  pathWithLocalBin()
);
