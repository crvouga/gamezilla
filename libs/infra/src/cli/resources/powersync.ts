import { join } from 'node:path';

import { assert } from '@pkgs/assert';

import { ok } from '../lib/fmt';
import { REPO_ROOT } from '../paths';
import type { CiPlatform } from '../platform/platform';
import {
  fetchSecret,
  secretExists,
  setSecret,
} from '../secrets/secrets';
import { runAsync, runCapture } from '../subprocess';
import { generatePowerSyncJwtKeypair } from './powersync-jwt';
import { resolveDatabaseUrl, verifyWalLevelLogical } from './neon-postgres';
import { ResourceBase, type InfraContext } from './types';
import { runPowerSyncSourceDbSetup } from './powersync-source-db';

const POWERSYNC_DIR = 'powersync';

const CLI_ENV_KEYS = [
  'POWERSYNC_INSTANCE_ID',
  'POWERSYNC_URL',
  'PS_ADMIN_TOKEN',
] as const;

function readTrimmedEnv(name: string): string {
  return (process.env[name] ?? '').trim();
}

function assertPowerSyncCliSecrets(): void {
  const missing = CLI_ENV_KEYS.filter((key) => readTrimmedEnv(key).length === 0);
  assert.ok(
    missing.length === 0,
    `PowerSync CLI secrets missing from env: ${missing.join(', ')} — add them in Infisical before deploying`
  );
}

function assertPowerSyncServiceSecrets(): void {
  assertPowerSyncCliSecrets();
  assert.ok(
    readTrimmedEnv('POWERSYNC_JWT_PUBLIC_JWK').length > 0,
    'POWERSYNC_JWT_PUBLIC_JWK missing — run `bun run infra provision` or deploy with service-config to auto-generate'
  );
  assert.ok(
    readTrimmedEnv('PS_DATABASE_PASSWORD').length > 0,
    'PS_DATABASE_PASSWORD missing — DATABASE_URL must be set (derived at deploy time from Infisical DATABASE_URL)'
  );
  injectPowerSyncJwtJwkFields();
}

/** Expand inline JWKS fields for service.yaml (!env per scalar — not whole JSON). */
export function injectPowerSyncJwtJwkFields(): void {
  const raw = readTrimmedEnv('POWERSYNC_JWT_PUBLIC_JWK');
  if (raw.length === 0) {
    ok('PowerSync JWT JWK', 'skipped (POWERSYNC_JWT_PUBLIC_JWK not set)');
    return;
  }
  const parsed: unknown = JSON.parse(raw);
  assert.ok(
    parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed),
    'POWERSYNC_JWT_PUBLIC_JWK must be a JSON object'
  );
  const jwk = parsed as Record<string, unknown>;
  const n = jwk['n'];
  const e = jwk['e'];
  assert.ok(typeof n === 'string' && n.length > 0, 'POWERSYNC_JWT_PUBLIC_JWK missing n');
  assert.ok(typeof e === 'string' && e.length > 0, 'POWERSYNC_JWT_PUBLIC_JWK missing e');
  process.env['POWERSYNC_JWT_N'] = n;
  process.env['POWERSYNC_JWT_E'] = e;
  ok('PowerSync JWT JWK', 'n/e fields derived for service.yaml');
}

/** PowerSync service.yaml DB fields — derived from `DATABASE_URL` at deploy time. */
export async function injectPowerSyncDatabaseUri(): Promise<void> {
  const url = readTrimmedEnv('PS_DATABASE_URI').length > 0
    ? readTrimmedEnv('PS_DATABASE_URI')
    : await resolveDatabaseUrl();

  const parsed = new URL(url);
  assert.ok(
    parsed.protocol === 'postgresql:' || parsed.protocol === 'postgres:',
    'DATABASE_URL must use postgresql:// or postgres://'
  );

  process.env['PS_DATABASE_URI'] = url;
  process.env['PS_DATABASE_HOST'] = parsed.hostname;
  process.env['PS_DATABASE_PORT'] = parsed.port.length > 0 ? parsed.port : '5432';
  process.env['PS_DATABASE_NAME'] = parsed.pathname.replace(/^\//, '');
  process.env['PS_DATABASE_USER'] = decodeURIComponent(parsed.username);
  process.env['PS_DATABASE_PASSWORD'] = decodeURIComponent(parsed.password);
  ok('PowerSync DB', 'connection fields derived from DATABASE_URL');
}

async function ensurePowerSyncJwtKeypair(platform: CiPlatform): Promise<void> {
  const hasPrivate =
    secretExists('POWERSYNC_JWT_PRIVATE_KEY') ||
    readTrimmedEnv('POWERSYNC_JWT_PRIVATE_KEY').length > 0;
  const hasPublic =
    readTrimmedEnv('POWERSYNC_JWT_PUBLIC_JWK').length > 0 ||
    secretExists('POWERSYNC_JWT_PUBLIC_JWK');

  if (hasPrivate && hasPublic) {
    ok('PowerSync JWT', 'keypair present');
    return;
  }

  const keypair = generatePowerSyncJwtKeypair();
  setSecret('POWERSYNC_JWT_PRIVATE_KEY', keypair.privateKeyPem);
  setSecret('POWERSYNC_JWT_PUBLIC_JWK', keypair.publicJwkJson);
  process.env['POWERSYNC_JWT_PRIVATE_KEY'] = keypair.privateKeyPem;
  process.env['POWERSYNC_JWT_PUBLIC_JWK'] = keypair.publicJwkJson;
  ok('PowerSync JWT', 'generated RS256 keypair in secret store');
  platform.notice(
    'Generated POWERSYNC_JWT_* keypair — re-run worker deploy so the API can mint sync tokens'
  );
}

async function loadPrivateKeyFromSecretsIfMissing(): Promise<void> {
  if (readTrimmedEnv('POWERSYNC_JWT_PRIVATE_KEY').length > 0) return;
  try {
    const value = fetchSecret('POWERSYNC_JWT_PRIVATE_KEY').trim();
    if (value.length > 0) {
      process.env['POWERSYNC_JWT_PRIVATE_KEY'] = value;
    }
  } catch {
    // optional until worker deploy
  }
}

function powersyncCliArgs(): string[] {
  if (runCapture('which', ['powersync']).length > 0) {
    return ['powersync'];
  }
  return ['bunx', 'powersync@latest'];
}

async function runPowerSyncCli(
  platform: CiPlatform,
  args: string[],
  label: string
): Promise<void> {
  const cliArgs = powersyncCliArgs();
  const cmd = cliArgs[0];
  assert.ok(typeof cmd === 'string' && cmd.length > 0, 'PowerSync CLI command missing');
  const baseArgs = cliArgs.slice(1);
  await runAsync(platform, cmd, [...baseArgs, ...args], {
    cwd: REPO_ROOT,
    env: process.env,
    label,
  });
}

/** PowerSync Cloud instance — validates secrets and deploys service + sync config. */
export class PowerSyncResource extends ResourceBase {
  readonly id = 'powersync';

  async provision(platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    await ensurePowerSyncJwtKeypair(platform);
    await loadPrivateKeyFromSecretsIfMissing();
    assertPowerSyncCliSecrets();
    await injectPowerSyncDatabaseUri();
    assertPowerSyncServiceSecrets();

    const url = await resolveDatabaseUrl();
    await verifyWalLevelLogical(url);
    ok('PowerSync', `instance ${readTrimmedEnv('POWERSYNC_INSTANCE_ID')}`);
  }

  async dryRun(platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    await ensurePowerSyncJwtKeypair(platform);
    assertPowerSyncCliSecrets();
    await injectPowerSyncDatabaseUri();
    assertPowerSyncServiceSecrets();
    await runPowerSyncCli(
      platform,
      ['validate', '--directory', POWERSYNC_DIR],
      'powersync validate'
    );
    ok('PowerSync validate', 'config OK');
  }

  async destroy(): Promise<void> {
    ok('PowerSync', 'Cloud instance manually managed — skipping');
  }
}

export async function ensurePowerSyncSourceDatabase(): Promise<void> {
  const url = await resolveDatabaseUrl();
  await runPowerSyncSourceDbSetup({ databaseUrl: url });
  ok('PowerSync source DB', 'publication powersync (all tables in public) + REPLICA IDENTITY FULL');
}

export async function deployPowerSyncConfig(
  platform: CiPlatform
): Promise<void> {
  await ensurePowerSyncJwtKeypair(platform);
  await loadPrivateKeyFromSecretsIfMissing();
  assertPowerSyncCliSecrets();
  await injectPowerSyncDatabaseUri();
  assertPowerSyncServiceSecrets();
  await runAsync(
    platform,
    'bun',
    ['run', join(REPO_ROOT, 'scripts/run-postgres-migrations-secrets.ts')],
    {
      cwd: REPO_ROOT,
      env: process.env,
      label: 'postgres migrate (secrets)',
    }
  );
  await runPowerSyncCli(
    platform,
    ['deploy', 'service-config', '--directory', POWERSYNC_DIR],
    'powersync deploy service-config'
  );
  await runPowerSyncCli(
    platform,
    ['deploy', 'sync-config', '--directory', POWERSYNC_DIR],
    'powersync deploy sync-config'
  );
  ok('PowerSync deploy', readTrimmedEnv('POWERSYNC_URL'));
}

export async function deployPowerSyncSyncConfigOnly(
  platform: CiPlatform
): Promise<void> {
  assertPowerSyncCliSecrets();
  await runAsync(
    platform,
    'bun',
    ['run', join(REPO_ROOT, 'scripts/run-postgres-migrations-secrets.ts')],
    {
      cwd: REPO_ROOT,
      env: process.env,
      label: 'postgres migrate (secrets)',
    }
  );
  await runPowerSyncCli(
    platform,
    ['deploy', 'sync-config', '--directory', POWERSYNC_DIR],
    'powersync deploy sync-config (dev)'
  );
  ok('PowerSync sync-config', 'deployed to dev instance');
}
