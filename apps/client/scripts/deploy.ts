#!/usr/bin/env bun
// @io-wall-ok — composition-root wall FS via ObjectStore migration pending
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { PRODUCT_CONFIG } from '@libs/db/public/product-config';
import { deleteLegacyWorkerScripts } from '@libs/secrets/shared/cloudflare-worker-lifecycle';
import { productionApiOrigin } from '@libs/secrets/shared/deploy-origins';
import { withNodeMaxOldSpaceSize } from '@libs/secrets/shared/eas-mobile';
import { ok } from '@libs/secrets/shared/fmt';
import { REPO_ROOT } from '@libs/secrets/shared/paths';
import { runAsync, runCapture } from '@libs/secrets/shared/subprocess';
import { wranglerArgs, wranglerEnv } from '@libs/secrets/shared/wrangler-env';
import { assert } from '@pkgs/assert';
import { wallClock } from '@pkgs/clock';
import { assertCommitDateIso, COMMIT_HASH_HEX_REGEX } from '@pkgs/git';
import { createLogger } from '@pkgs/logger';
import { isProductionSecretsEnv } from '../../../tools/src/deploy-mode';

const log = createLogger({ name: 'client:deploy', now: wallClock.now });

const clientDir = join(import.meta.dirname, '..');

function resolveCommitHash(): string {
  const rawSha = runCapture('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT });
  const commitHash = rawSha.trim().toLowerCase();
  assert.ok(
    COMMIT_HASH_HEX_REGEX.test(commitHash),
    'client-worker: git HEAD must be a valid lowercase hex commit SHA',
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

function cleanupClientDist(): void {
  rmSync(join(clientDir, 'dist'), {
    recursive: true,
    force: true,
  });
}

const CLIENT_EXPORT_MAX_OLD_SPACE_MB = 8192;

async function buildClientWeb(
  commitHash: string,
  commitDate: string
): Promise<void> {
  const apiUrl = productionApiOrigin();
  const buildEnv = withNodeMaxOldSpaceSize(
    {
      ...process.env,
      EXPO_PUBLIC_API_URL: apiUrl,
      EXPO_PUBLIC_COMMIT_HASH: commitHash,
      EXPO_PUBLIC_COMMIT_DATE: commitDate,
    },
    CLIENT_EXPORT_MAX_OLD_SPACE_MB
  );

  await runAsync('bun', ['run', 'check:production-env'], {
    cwd: clientDir,
    label: 'client-worker: production client build env gate',
    env: buildEnv,
  });

  await runAsync('bun', ['run', 'build'], {
    cwd: clientDir,
    label: 'client-worker: expo export (static web assets)',
    env: buildEnv,
  });

  await runAsync('bun', ['run', 'check:production-dist'], {
    cwd: clientDir,
    label: 'client-worker: production web dist API URL gate',
    env: buildEnv,
  });
}

async function deploy(dryRun: boolean): Promise<void> {
  const commitHash = resolveCommitHash();
  const commitDate = resolveCommitDate();

  await buildClientWeb(commitHash, commitDate);

  if (!dryRun) {
    deleteLegacyWorkerScripts();
  }

  const wranglerDeployArgs = dryRun
    ? wranglerArgs('deploy', '--dry-run')
    : wranglerArgs('deploy');
  const label = dryRun
    ? 'client-worker: Cloudflare Workers deploy (dry-run)'
    : 'client-worker: Cloudflare Workers deploy (static assets)';

  try {
    await runAsync('wrangler', wranglerDeployArgs, {
      cwd: clientDir,
      env: wranglerEnv(),
      label,
    });
  } finally {
    cleanupClientDist();
  }

  if (dryRun) {
    ok('client-worker dry-run', 'client bundle + assets-only worker validated');
    return;
  }

  log.info(
    `Client Worker deployed (${PRODUCT_CONFIG.cloudflare.clientWorker}) on gamezilla.app / www.gamezilla.app.`
  );
}

const dryRun = !isProductionSecretsEnv();
if (dryRun) {
  log.info('[client:deploy] dry-run (SECRETS_ENV is not prd)');
}
await deploy(dryRun);
