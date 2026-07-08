import { assert } from '@pkgs/assert';
import { COMMIT_HASH_HEX_REGEX, assertCommitDateIso } from '@pkgs/git';
import { resolveSecretsScope } from '@pkgs/secrets-config/infisical-json';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveAuthPublishableKeyForClientBuild } from '../lib/client-build-env';
import {
  assertExpoTokenPresent,
  publishClientEasUpdate,
  resolveEasProfile,
  resolveEasProfileWithNotice,
} from '../lib/eas-mobile';
import {
  deleteProductionWorker,
  isDoMigrationStateError,
  readLatestWranglerLogTail,
} from '../lib/cloudflare-worker-lifecycle';
import { ok, warn } from '../lib/fmt';
import { productionOrigin } from '../lib/infra-outputs';
import { REPO_ROOT } from '../paths';
import type { CiPlatform } from '../platform/platform';
import { cfAccountId } from '../secrets/cloudflare';
import { getSecretMap } from '../secrets/secrets';
import { API_WORKER_EXTERNALLY_MANAGED_SECRET_KEYS } from '../secrets/worker-api-secrets';
import { runAsync, runCapture } from '../subprocess';
import { ResourceBase, type InfraContext } from './types';

const WRANGLER_ENV = 'production';

const WORKER_EXTRA_ENV_KEYS = [
  'SECRETS_ENV',
  'OBSERVABILITY_BACKEND',
  'OBSERVABILITY_COLLECTOR_URL',
  'SENTRY_DSN',
] as const;

function buildWorkerSecretBulkPayload(): Record<string, string> {
  const scope = resolveSecretsScope(REPO_ROOT);
  const payload: Record<string, string> = {
    SECRETS_ENV: scope.env,
  };

  for (const entry of getSecretMap()) {
    const value = (process.env[entry.env] ?? '').trim();
    if (value.length === 0) {
      if (entry.optional === true) continue;
      assert.fail(`Worker deploy: missing secret ${entry.secretKey}`);
    }
    payload[entry.env] = value;
  }

  for (const key of API_WORKER_EXTERNALLY_MANAGED_SECRET_KEYS) {
    const value = (process.env[key] ?? '').trim();
    if (value.length === 0) {
      assert.fail(
        `Worker deploy: missing secret ${key} (add to Infisical env \`${scope.env}\`)`
      );
    }
    payload[key] = value;
  }

  for (const key of WORKER_EXTRA_ENV_KEYS) {
    const value = (process.env[key] ?? '').trim();
    if (value.length > 0) {
      payload[key] = value;
    }
  }

  return payload;
}

async function pushWorkerSecrets(
  platform: CiPlatform,
  apiDir: string,
  env: NodeJS.ProcessEnv
): Promise<void> {
  const payload = buildWorkerSecretBulkPayload();
  const bulkPath = join(tmpdir(), `wrangler-secrets-${process.pid}.json`);
  writeFileSync(bulkPath, JSON.stringify(payload), 'utf8');
  try {
    await runAsync(
      platform,
      'wrangler',
      wranglerArgs('secret', 'bulk', bulkPath),
      {
        cwd: apiDir,
        env,
        label: 'api-worker: wrangler secret bulk',
      }
    );
  } finally {
    rmSync(bulkPath, { force: true });
  }
  ok(
    'Worker secrets',
    `pushed ${Object.keys(payload).length} bindings via wrangler secret bulk`
  );
}

function validateSecretsForDeploy(): void {
  const scope = resolveSecretsScope(REPO_ROOT);
  buildWorkerSecretBulkPayload();
  ok('Secrets preflight', `env=${scope.env} payload validated`);
}

function wranglerEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CLOUDFLARE_ACCOUNT_ID: cfAccountId(),
  };
}

function wranglerArgs(...args: string[]): string[] {
  return ['--env', WRANGLER_ENV, ...args];
}

function resolveCommitHash(): string {
  const rawSha = runCapture('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT });
  const commitHash = rawSha.trim().toLowerCase();
  assert.ok(
    COMMIT_HASH_HEX_REGEX.test(commitHash),
    'api-worker: git HEAD must be a valid lowercase hex commit SHA',
    { rawSha }
  );
  return commitHash;
}

function resolveCommitDate(): string {
  const rawDate = runCapture('git', ['log', '-1', '--format=%cI', 'HEAD'], {
    cwd: REPO_ROOT,
  });
  const commitDate = rawDate.trim();
  assertCommitDateIso(commitDate);
  return commitDate;
}

async function buildClientForWorker(
  platform: CiPlatform,
  commitHash: string,
  commitDate: string
): Promise<void> {
  const clientDir = join(REPO_ROOT, 'apps/client');
  const apiUrl = productionOrigin();
  const buildEnv: NodeJS.ProcessEnv = {
    ...process.env,
    EXPO_PUBLIC_API_URL: apiUrl,
    EXPO_PUBLIC_COMMIT_HASH: commitHash,
    EXPO_PUBLIC_COMMIT_DATE: commitDate,
    EXPO_PUBLIC_AUTH_PUBLISHABLE_KEY: resolveAuthPublishableKeyForClientBuild(),
  };

  await runAsync(platform, 'bun', ['run', 'check:production-env'], {
    cwd: clientDir,
    label: 'api-worker: production client build env gate',
    env: buildEnv,
  });

  await runAsync(platform, 'bun', ['run', 'build'], {
    cwd: clientDir,
    label: 'api-worker: expo export (client static assets)',
    env: buildEnv,
  });

  await runAsync(platform, 'bun', ['run', 'check:production-dist'], {
    cwd: clientDir,
    label: 'api-worker: production web dist API URL gate',
    env: buildEnv,
  });
}

function cleanupClientDist(): void {
  rmSync(join(REPO_ROOT, 'apps/client/dist'), {
    recursive: true,
    force: true,
  });
}

export class ApiWorkerResource extends ResourceBase {
  readonly id = 'api-worker';

  async provision(_platform: CiPlatform, _ctx: InfraContext): Promise<void> {}

  async dryRun(platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    validateSecretsForDeploy();
    const commitHash = resolveCommitHash();
    const commitDate = resolveCommitDate();

    await buildClientForWorker(platform, commitHash, commitDate);

    const apiDir = join(REPO_ROOT, 'apps/api');
    try {
      await runAsync(
        platform,
        'wrangler',
        wranglerArgs('deploy', '--dry-run'),
        {
          cwd: apiDir,
          env: wranglerEnv(),
          label: 'api-worker: Cloudflare Workers deploy (dry-run)',
        }
      );
    } finally {
      cleanupClientDist();
    }

    if (resolveEasProfile() !== null) {
      assertExpoTokenPresent();
      assert.nonEmptyString(
        process.env['EXPO_PUBLIC_API_URL'] ?? productionOrigin(),
        'EXPO_PUBLIC_API_URL must be set for the EAS OTA update (secrets/env); ' +
          'a missing value blank-screens the published bundle on launch'
      );
      ok(
        'api-worker dry-run',
        'EXPO_TOKEN + EXPO_PUBLIC_API_URL present for EAS OTA update'
      );
    }

    ok(
      'api-worker dry-run',
      'client bundle + worker bindings validated locally'
    );
  }

  async deploy(platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    const apiDir = join(REPO_ROOT, 'apps/api');
    const env = wranglerEnv();
    const commitHash = resolveCommitHash();
    const commitDate = resolveCommitDate();

    validateSecretsForDeploy();

    await buildClientForWorker(platform, commitHash, commitDate);

    await pushWorkerSecrets(platform, apiDir, env);

    try {
      await deployProductionWorker(platform, apiDir, env);
    } finally {
      cleanupClientDist();
    }

    platform.notice(
      'Worker deployed with API routes + client static assets on gamezilla.app / www.gamezilla.app.'
    );
  }

  /**
   * Mobile half of the client deploy: publish an OTA `eas update`. Runs after
   * the unified Worker (API + web) is live and smoke-tested.
   */
  async publishEasUpdate(
    platform: CiPlatform,
    _ctx: InfraContext
  ): Promise<void> {
    const profile = resolveEasProfileWithNotice(platform);
    if (profile === null) return;
    await publishClientEasUpdate(platform, profile);
  }

  destroy(): void {
    deleteProductionWorker();
  }
}

/**
 * Deploy the production Worker. If Cloudflare rejects the DO migration because
 * an earlier deploy recorded migration tags without exporting the class (the
 * pre-fix `[env.production]` gap), delete the script and retry once so
 * migrations apply against a clean slate.
 */
async function deployProductionWorker(
  platform: CiPlatform,
  apiDir: string,
  env: NodeJS.ProcessEnv
): Promise<void> {
  const deployArgs = wranglerArgs('deploy');
  const label = 'api-worker: Cloudflare Workers deploy (API + static assets)';

  let deployFailed = false;
  try {
    await runAsync(platform, 'wrangler', deployArgs, {
      cwd: apiDir,
      env,
      label,
    });
  } catch {
    deployFailed = true;
  }
  if (!deployFailed) return;

  if (!isDoMigrationStateError(readLatestWranglerLogTail())) {
    assert.fail(`${label} failed`);
  }

  warn(
    'DO migration',
    'script migration state is inconsistent with exports — deleting worker and redeploying'
  );
  platform.notice(
    'Resetting the production Worker script (Durable Object storage is wiped). ' +
      'This is a one-time recovery from deploys that ran before ROOM bindings ' +
      'were wired into `[env.production]`.'
  );
  deleteProductionWorker();

  await runAsync(platform, 'wrangler', deployArgs, {
    cwd: apiDir,
    env,
    label,
  });
}
