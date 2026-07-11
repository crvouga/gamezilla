/**
 * Mint a dev PowerSync JWT and open the Sync Diagnostics Client with it.
 *
 * Usage:
 *   bun run ps:dev
 *   bun run ps:dev -- --subject=my-test-user
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { assert } from '@pkgs/assert';
import { assertDevSecretsEnv } from '../libs/infra/src/shared/database-url-policy';

const REPO_ROOT = join(import.meta.dirname, '..');
const POWERSYNC_DIR = 'powersync';
const DIAGNOSTICS_APP_URL = 'https://diagnostics-app.powersync.com/';
const DEFAULT_SUBJECT = 'diagnostics-dev';

const JWT_PATTERN = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

function trimEnv(name: string): string {
  return (process.env[name] ?? '').trim();
}

function readSubjectArg(): string {
  const flag = '--subject=';
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith(flag)) {
      const value = arg.slice(flag.length).trim();
      assert.ok(value.length > 0, '--subject must be a non-empty user id');
      return value;
    }
    if (arg === '--subject') {
      const next = process.argv[process.argv.indexOf(arg) + 1]?.trim() ?? '';
      assert.ok(next.length > 0, '--subject requires a value');
      return next;
    }
  }
  return DEFAULT_SUBJECT;
}

function runCapture(cmd: string, args: string[]): string {
  return execFileSync(cmd, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  }).trim();
}

function runOrThrow(cmd: string, args: string[], label: string): void {
  const result = spawnSync(cmd, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: 'inherit',
    env: process.env,
  });
  assert.ok(
    result.status === 0,
    `${label} failed (exit ${String(result.status ?? 'unknown')})`
  );
}

function resolvePowersyncCmd(): string {
  try {
    runCapture('which', ['powersync']);
    return 'powersync';
  } catch {
    return 'bunx';
  }
}

function powersyncGenerateTokenArgs(subject: string): {
  cmd: string;
  args: string[];
} {
  const cmd = resolvePowersyncCmd();
  if (cmd === 'bunx') {
    return {
      cmd,
      args: [
        'powersync@latest',
        'generate',
        'token',
        '--subject',
        subject,
        '--directory',
        POWERSYNC_DIR,
      ],
    };
  }
  return {
    cmd,
    args: ['generate', 'token', '--subject', subject, '--directory', POWERSYNC_DIR],
  };
}

function extractJwt(stdout: string): string {
  const matches = stdout.match(JWT_PATTERN);
  assert.ok(
    matches !== null && matches.length > 0,
    'powersync generate token did not return a JWT — ensure PS_ADMIN_TOKEN or powersync login is configured for the dev instance'
  );
  return matches[matches.length - 1]!;
}

function assertPowerSyncDevSecrets(): void {
  assert.ok(
    trimEnv('POWERSYNC_INSTANCE_ID').length > 0,
    'POWERSYNC_INSTANCE_ID missing in secrets env dev'
  );
  const hasAdminToken = trimEnv('PS_ADMIN_TOKEN').length > 0;
  if (!hasAdminToken) {
    process.stdout.write(
      '[ps:dev] PS_ADMIN_TOKEN not set — falling back to stored powersync login token\n'
    );
  }
}

function main(): void {
  assertDevSecretsEnv(trimEnv('SECRETS_ENV') || 'dev');
  assertPowerSyncDevSecrets();

  const subject = readSubjectArg();
  const { cmd, args } = powersyncGenerateTokenArgs(subject);
  process.stdout.write(
    `[ps:dev] generating dev token for subject=${subject} via ${cmd}\n`
  );

  const stdout = runCapture(cmd, args);
  const token = extractJwt(stdout);
  const url = new URL(DIAGNOSTICS_APP_URL);
  url.searchParams.set('token', token);

  process.stdout.write(`[ps:dev] opening ${DIAGNOSTICS_APP_URL}?token=…\n`);
  runOrThrow('bun', ['x', 'open', url.toString()], 'open diagnostics app');
}

main();
