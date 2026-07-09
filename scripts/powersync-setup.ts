/**
 * Idempotent PowerSync Cloud CLI bootstrap:
 * - ensures `powersync` CLI is on PATH
 * - verifies Cloud auth (PS_ADMIN_TOKEN or prior `powersync login`)
 * - links `powersync/cli.yaml` to the Infisical instance id
 * - pulls remote service + sync config once (or with --force-pull)
 *
 * Usage:
 *   bun run powersync:setup:dev
 *   bun run powersync:setup:dev -- --force-pull
 */
import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import { assert } from '@pkgs/assert';
import {
  injectPowerSyncDatabaseUri,
  injectPowerSyncJwtJwkFields,
} from '../libs/infra/src/cli/resources/powersync';
import { runPostgresMigrationsFromSecrets } from './run-postgres-migrations-secrets';
import { loadSecretsIntoEnv } from '../libs/infra/src/cli/secrets/secrets';

const REPO_ROOT = join(import.meta.dirname, '..');
const POWERSYNC_DIR = 'powersync';
const POWERSYNC_DIR_ABS = join(REPO_ROOT, POWERSYNC_DIR);
const PULL_STATE_PATH = join(POWERSYNC_DIR_ABS, '.pull-state.json');
const SERVICE_PATH = join(POWERSYNC_DIR_ABS, 'service.yaml');
const SYNC_CONFIG_PATH = join(POWERSYNC_DIR_ABS, 'sync-config.yaml');
const CLI_PATH = join(POWERSYNC_DIR_ABS, 'cli.yaml');

type PullState = {
  readonly instanceId: string;
  readonly pulledAt: string;
};

function trimEnv(name: string): string {
  return (process.env[name] ?? '').trim();
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function runCapture(cmd: string, args: string[], cwd = REPO_ROOT): string {
  return execFileSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
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

function powersyncCmd(): string {
  try {
    runCapture('which', ['powersync']);
    return 'powersync';
  } catch {
    process.stdout.write(
      '[powersync-setup] powersync not on PATH — installing globally via npm\n'
    );
    runOrThrow(
      'npm',
      ['install', '-g', 'powersync'],
      'npm install -g powersync'
    );
    runCapture('which', ['powersync']);
    return 'powersync';
  }
}

function readPullState(): PullState | null {
  if (!existsSync(PULL_STATE_PATH)) return null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(PULL_STATE_PATH, 'utf8'));
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      typeof (parsed as PullState).instanceId === 'string'
    ) {
      return parsed as PullState;
    }
  } catch {
    return null;
  }
  return null;
}

function writePullState(state: PullState): void {
  mkdirSync(POWERSYNC_DIR_ABS, { recursive: true });
  writeFileSync(PULL_STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function backupConfigFiles(): void {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  for (const path of [SERVICE_PATH, SYNC_CONFIG_PATH, CLI_PATH]) {
    if (!existsSync(path)) continue;
    const backup = `${path}.backup-${stamp}`;
    copyFileSync(path, backup);
    process.stdout.write(`[powersync-setup] backed up ${path} → ${backup}\n`);
  }
}

function assertRequiredSecrets(): { instanceId: string; url: string } {
  const instanceId = trimEnv('POWERSYNC_INSTANCE_ID');
  const url = trimEnv('POWERSYNC_URL');
  assert.ok(
    instanceId.length > 0,
    'POWERSYNC_INSTANCE_ID missing in secrets env'
  );
  assert.ok(url.length > 0, 'POWERSYNC_URL missing in secrets env');
  const projectId = trimEnv('POWERSYNC_PROJECT_ID');
  if (projectId.length > 0) {
    process.stdout.write(
      `[powersync-setup] project id ${projectId} (informational; CLI resolves from instance)\n`
    );
  }
  return { instanceId, url };
}

function cloudAuthReady(): boolean {
  try {
    const raw = runCapture('powersync', [
      'fetch',
      'instances',
      '--output=json',
    ]);
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      return false;
    }
    const cloud = (parsed as Record<string, unknown>)['cloudInstances'];
    if (cloud === null || typeof cloud !== 'object' || Array.isArray(cloud)) {
      return false;
    }
    return Object.keys(cloud).length > 0;
  } catch {
    return false;
  }
}

function assertCloudAuth(): void {
  if (trimEnv('PS_ADMIN_TOKEN').length > 0) {
    process.stdout.write('[powersync-setup] using PS_ADMIN_TOKEN from env\n');
    return;
  }
  if (cloudAuthReady()) {
    process.stdout.write(
      '[powersync-setup] Cloud auth OK (stored login token)\n'
    );
    return;
  }
  assert.fail(
    'PowerSync Cloud auth missing — run `powersync login` in an interactive terminal, or add PS_ADMIN_TOKEN to Infisical'
  );
}

function linkInstance(cli: string, instanceId: string): void {
  if (existsSync(CLI_PATH)) {
    const current = readFileSync(CLI_PATH, 'utf8');
    if (
      current.includes('POWERSYNC_INSTANCE_ID') ||
      current.includes(instanceId)
    ) {
      process.stdout.write('[powersync-setup] cli.yaml already linked\n');
      return;
    }
  }
  runOrThrow(
    cli,
    [
      'link',
      'cloud',
      `--instance-id=${instanceId}`,
      '--directory',
      POWERSYNC_DIR,
    ],
    'powersync link cloud'
  );
}

function shouldPull(instanceId: string): boolean {
  if (hasFlag('--force-pull')) return true;
  const state = readPullState();
  if (state?.instanceId === instanceId) {
    process.stdout.write(
      '[powersync-setup] pull skipped (already pulled for this instance; use --force-pull)\n'
    );
    return false;
  }
  if (!existsSync(SERVICE_PATH) || !existsSync(SYNC_CONFIG_PATH)) {
    return true;
  }
  if (state === null) {
    process.stdout.write(
      '[powersync-setup] local config exists but no pull state — skipping pull (use --force-pull to refresh from cloud)\n'
    );
    return false;
  }
  return state.instanceId !== instanceId;
}

function ensureCloudServiceYaml(instanceId: string): void {
  if (!existsSync(SERVICE_PATH)) return;
  let content = readFileSync(SERVICE_PATH, 'utf8');
  if (!content.includes('_type: cloud')) {
    content = `_type: cloud\nname: development\nregion: us\n\n${content}`;
  }
  if (!content.includes('replication:')) {
    content = `${content.trim()}\n\nreplication:\n  connections:\n    - type: postgresql\n      hostname: !env PS_DATABASE_HOST\n      port: !env PS_DATABASE_PORT::number\n      database: !env PS_DATABASE_NAME\n      username: !env PS_DATABASE_USER\n      password:\n        secret: !env PS_DATABASE_PASSWORD\n      sslmode: verify-full\n`;
  }
  if (!content.includes('client_auth:')) {
    content = `${content.trim()}\n\nclient_auth:\n  jwks:\n    keys:\n      - kty: RSA\n        kid: powersync\n        alg: RS256\n        use: sig\n        n: !env POWERSYNC_JWT_N\n        e: !env POWERSYNC_JWT_E\n  additional_audiences:\n    - !env POWERSYNC_URL\n`;
  }
  writeFileSync(SERVICE_PATH, `${content.trim()}\n`, 'utf8');
  process.stdout.write(
    `[powersync-setup] ensured cloud service.yaml (${instanceId})\n`
  );
}

function pullInstance(cli: string, instanceId: string): void {
  backupConfigFiles();
  const args = [
    'pull',
    'instance',
    `--instance-id=${instanceId}`,
    '--directory',
    POWERSYNC_DIR,
  ];
  if (hasFlag('--force-pull') || existsSync(SERVICE_PATH)) {
    args.push('--overwrite');
  }
  runOrThrow(cli, args, 'powersync pull instance');
  ensureCloudServiceYaml(instanceId);
  writePullState({
    instanceId,
    pulledAt: new Date().toISOString(),
  });
}

function confirmPull(instanceId: string, url: string, cli: string): void {
  assert.ok(existsSync(CLI_PATH), `${CLI_PATH} missing after link/pull`);
  assert.ok(
    existsSync(SERVICE_PATH),
    `${SERVICE_PATH} missing after link/pull`
  );
  assert.ok(
    existsSync(SYNC_CONFIG_PATH),
    `${SYNC_CONFIG_PATH} missing after link/pull`
  );
  const service = readFileSync(SERVICE_PATH, 'utf8');
  const sync = readFileSync(SYNC_CONFIG_PATH, 'utf8');
  assert.ok(service.trim().length > 0, 'service.yaml is empty');
  assert.ok(sync.trim().length > 0, 'sync-config.yaml is empty');
  assert.ok(
    service.includes('_type: cloud'),
    'service.yaml must declare _type: cloud'
  );
  assert.ok(
    sync.includes('edition: 3'),
    'sync-config.yaml should use Sync Streams edition 3'
  );

  const hasJwk =
    trimEnv('POWERSYNC_JWT_N').length > 0 &&
    trimEnv('POWERSYNC_JWT_E').length > 0;
  if (hasJwk) {
    runOrThrow(
      cli,
      [
        'validate',
        '--directory',
        POWERSYNC_DIR,
        '--validate-only=configuration',
      ],
      'powersync validate (configuration)'
    );
  } else {
    process.stdout.write(
      '[powersync-setup] skipped config validate — set POWERSYNC_JWT_PUBLIC_JWK in dev (run infra provision) before deploy\n'
    );
  }

  const fetched = runCapture(cli, [
    'fetch',
    'config',
    '--directory',
    POWERSYNC_DIR,
    '--output=json',
  ]);
  assert.ok(
    fetched.includes('"name": "development"'),
    'fetch config should return cloud instance metadata'
  );

  process.stdout.write(
    `[powersync-setup] OK — linked ${url} (${instanceId}), service + sync config present\n`
  );
}

async function main(): Promise<void> {
  loadSecretsIntoEnv();
  const { instanceId, url } = assertRequiredSecrets();
  const cli = powersyncCmd();
  assertCloudAuth();
  await injectPowerSyncDatabaseUri();
  injectPowerSyncJwtJwkFields();
  process.stdout.write('[powersync-setup] applying db schema + publication (idempotent)\n');
  await runPostgresMigrationsFromSecrets();
  linkInstance(cli, instanceId);

  if (shouldPull(instanceId)) {
    pullInstance(cli, instanceId);
  } else {
    ensureCloudServiceYaml(instanceId);
  }

  confirmPull(instanceId, url, cli);
}

void main();
