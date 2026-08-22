#!/usr/bin/env bun
// @io-wall-ok — composition-root wall FS via ObjectStore migration pending
import { rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assert } from '@pkgs/assert';
import { isProductionSecretsEnv } from '../../../tools/src/deploy-mode';
import { REPO_ROOT } from '@libs/secrets/shared/paths';
import { ok } from '@libs/secrets/shared/fmt';
import { runAsync } from '@libs/secrets/shared/subprocess';
import { wranglerEnv, wranglerArgs } from '@libs/secrets/shared/wrangler-env';
import {
  deleteLegacyWorkerScripts,
  deleteProductionWorker,
  isDoMigrationStateError,
  readLatestWranglerLogTail,
} from '@libs/secrets/shared/cloudflare-worker-lifecycle';
import { productionApiOrigin } from '@libs/secrets/shared/deploy-origins';
import {
  assertExpoTokenPresent,
  resolveEasProfile,
} from '@libs/secrets/shared/eas-mobile';
import {
  activeSecretsEnv,
  getApiWorkerSecrets,
} from '@libs/secrets/shared/secrets/secrets';

const apiDir = join(REPO_ROOT, 'apps/server');

const WORKER_EXTRA_ENV_KEYS = [
  'SECRETS_ENV',
  'OBSERVABILITY_BACKEND',
  'OBSERVABILITY_COLLECTOR_URL',
] as const;

async function buildWorkerSecretBulkPayload(): Promise<Record<string, string>> {
  const scope = activeSecretsEnv();
  const payload: Record<string, string> = {
    SECRETS_ENV: scope,
  };

  for (const entry of getApiWorkerSecrets()) {
    const value = (process.env[entry.name] ?? '').trim();
    if (value.length === 0) {
      if (entry.optional) continue;
      assert.fail(
        `Worker deploy: missing secret ${entry.name} (add to secrets env \`${scope}\`)`
      );
    }
    payload[entry.name] = value;
  }

  for (const key of WORKER_EXTRA_ENV_KEYS) {
    const value = (process.env[key] ?? '').trim();
    if (value.length > 0) {
      payload[key] = value;
    }
  }

  return payload;
}

async function pushWorkerSecrets(env: NodeJS.ProcessEnv): Promise<void> {
  const payload = await buildWorkerSecretBulkPayload();
  const bulkPath = join(tmpdir(), `wrangler-secrets-${process.pid}.json`);
  writeFileSync(bulkPath, JSON.stringify(payload), 'utf8');
  try {
    await runAsync('wrangler', wranglerArgs('secret', 'bulk', bulkPath), {
      cwd: apiDir,
      env,
      label: 'api-worker: wrangler secret bulk',
    });
  } finally {
    rmSync(bulkPath, { force: true });
  }
  ok(
    'Worker secrets',
    `pushed ${Object.keys(payload).length} bindings via wrangler secret bulk`
  );
}

async function validateSecretsForDeploy(): Promise<void> {
  const scope = activeSecretsEnv();
  await buildWorkerSecretBulkPayload();
  ok('Secrets preflight', `env=${scope} payload validated`);
}

async function deployProductionWorker(
  env: NodeJS.ProcessEnv,
  dryRun: boolean
): Promise<void> {
  const deployArgs = dryRun
    ? wranglerArgs('deploy', '--dry-run')
    : wranglerArgs('deploy');
  const label = dryRun
    ? 'api-worker: Cloudflare Workers deploy (dry-run)'
    : 'api-worker: Cloudflare Workers deploy';

  if (dryRun) {
    await runAsync('wrangler', deployArgs, { cwd: apiDir, env, label });
    return;
  }

  let deployFailed = false;
  try {
    await runAsync('wrangler', deployArgs, { cwd: apiDir, env, label });
  } catch {
    deployFailed = true;
  }
  if (!deployFailed) return;

  if (!isDoMigrationStateError(readLatestWranglerLogTail())) {
    assert.fail(`${label} failed`);
  }

  console.warn(
    'DO migration: script migration state is inconsistent with exports — deleting worker and redeploying'
  );
  deleteProductionWorker();

  await runAsync('wrangler', deployArgs, { cwd: apiDir, env, label });
}

async function dryRun(): Promise<void> {
  const env = wranglerEnv();
  await validateSecretsForDeploy();
  await deployProductionWorker(env, true);

  if (resolveEasProfile() !== null) {
    assertExpoTokenPresent();
    assert.nonEmptyString(
      process.env['EXPO_PUBLIC_API_URL'] ?? productionApiOrigin(),
      'EXPO_PUBLIC_API_URL must be set for the EAS OTA update (secrets/env); ' +
        'a missing value blank-screens the published bundle on launch'
    );
    ok(
      'api-worker dry-run',
      'EXPO_TOKEN + EXPO_PUBLIC_API_URL present for EAS OTA update'
    );
  }

  ok('api-worker dry-run', 'worker bindings validated locally');
}

async function deploy(): Promise<void> {
  const env = wranglerEnv();
  await validateSecretsForDeploy();
  deleteLegacyWorkerScripts();
  await pushWorkerSecrets(env);
  await deployProductionWorker(env, false);

  await runAsync(
    'bun',
    ['run', '--filter', '@apps/server', '--elide-lines=0', 'billing:sync'],
    {
      cwd: REPO_ROOT,
      label: 'billing: catalog reconcile',
    }
  );

  console.log(
    'API Worker deployed on api.gamezilla.app (Hono + Durable Objects).'
  );
}

const production = isProductionSecretsEnv();
if (!production) {
  console.log('[server:deploy] dry-run (SECRETS_ENV is not prd)');
  await dryRun();
} else {
  await deploy();
}
