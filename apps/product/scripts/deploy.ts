#!/usr/bin/env bun
// @io-wall-ok — composition-root wall FS via ObjectStore migration pending
/**
 * Super-app deploy: Vite build of `@apps/product` (App at `/`, console at `/console`) → Cloudflare assets Worker on gamezilla.app / www. Deletes the retired console Worker scripts on prd apply.
 */
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PRODUCT_CONFIG } from '@libs/db/public/product-config';
import {
  deleteLegacyWorkerScripts,
  deleteWorkerByName,
} from '@libs/secrets/shared/cloudflare-worker-lifecycle';
import {
  productionApiOrigin,
  productionClientOrigin,
} from '@libs/secrets/shared/deploy-origins';
import { ok } from '@libs/secrets/shared/fmt';
import { withNodeMaxOldSpaceSize } from '@libs/secrets/shared/node-options';
import { REPO_ROOT } from '@libs/secrets/shared/paths';
import { runAsync, runCapture } from '@libs/secrets/shared/subprocess';
import { waitForHttp } from '@libs/secrets/shared/wait-for-http';
import { wranglerArgs, wranglerEnv } from '@libs/secrets/shared/wrangler-env';
import { wallClock } from '@pkgs/clock';
import { assertCommitDateIso, COMMIT_HASH_HEX_REGEX } from '@pkgs/git';
import { createLogger } from '@pkgs/logger';
import { isProductionSecretsEnv } from '../../../tools/src/deploy-mode';

const log = createLogger({ name: 'product:deploy', now: wallClock.now });

const productDir = join(import.meta.dirname, '..');

/** COOP/COEP for SharedArrayBuffer (sqlite-wasm OPFS SAH pool) on Workers assets. */
const SQLITE_WEB_COOP = 'same-origin';
const SQLITE_WEB_COEP = 'require-corp';

/** Retired console + pre-cutover sim Workers — delete on every prd apply. */
const RETIRED_WORKER_SCRIPT_NAMES = [
  'gamezilla-console',
  'gamezilla-console-production',
  'gamezilla-sim',
  'gamezilla-sim-production',
] as const;

const PRODUCT_EXPORT_MAX_OLD_SPACE_MB = 8192;

function resolveCommitHash(): string {
  const rawSha = runCapture('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT });
  const commitHash = rawSha.trim().toLowerCase();
  assert.ok(
    COMMIT_HASH_HEX_REGEX.test(commitHash),
    'product-worker: git HEAD must be a valid lowercase hex commit SHA',
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

function cleanupProductDist(): void {
  rmSync(join(productDir, 'dist'), {
    recursive: true,
    force: true,
  });
}

function writeDistIsolationHeaders(): void {
  const body = [
    '/*',
    `\tCross-Origin-Opener-Policy: ${SQLITE_WEB_COOP}`,
    `\tCross-Origin-Embedder-Policy: ${SQLITE_WEB_COEP}`,
    '',
  ].join('\n');
  writeFileSync(join(productDir, 'dist', '_headers'), body, 'utf8');
}

async function buildProductWeb(
  commitHash: string,
  commitDate: string
): Promise<void> {
  const apiUrl = productionApiOrigin();
  const buildEnv = withNodeMaxOldSpaceSize(
    {
      ...process.env,
      VITE_API_URL: apiUrl,
      VITE_COMMIT_HASH: commitHash,
      VITE_COMMIT_DATE: commitDate,
    },
    PRODUCT_EXPORT_MAX_OLD_SPACE_MB
  );

  await runAsync('bun', ['run', 'check:production-env'], {
    cwd: productDir,
    label: 'product-worker: production build env gate',
    env: buildEnv,
  });

  await runAsync('bun', ['run', 'build'], {
    cwd: productDir,
    label: 'product-worker: Vite build (static web assets)',
    env: buildEnv,
  });

  writeDistIsolationHeaders();

  await runAsync('bun', ['run', 'check:production-dist'], {
    cwd: productDir,
    label: 'product-worker: production web dist API URL gate',
    env: buildEnv,
  });
}

function deleteRetiredWorkerScripts(): void {
  for (const name of RETIRED_WORKER_SCRIPT_NAMES) {
    deleteWorkerByName(name);
  }
}

async function deploy(dryRun: boolean): Promise<void> {
  const commitHash = resolveCommitHash();
  const commitDate = resolveCommitDate();

  await buildProductWeb(commitHash, commitDate);

  if (!dryRun) {
    deleteLegacyWorkerScripts();
  }

  const wranglerDeployArgs = dryRun
    ? wranglerArgs('deploy', '--dry-run')
    : wranglerArgs('deploy');
  const label = dryRun
    ? 'product-worker: Cloudflare Workers deploy (dry-run)'
    : 'product-worker: Cloudflare Workers deploy (static assets)';

  try {
    await runAsync('wrangler', wranglerDeployArgs, {
      cwd: productDir,
      env: wranglerEnv(),
      label,
    });
  } finally {
    cleanupProductDist();
  }

  if (dryRun) {
    ok(
      'product-worker dry-run',
      'super-app bundle + assets-only worker validated'
    );
    return;
  }

  deleteRetiredWorkerScripts();

  await waitForHttp(productionClientOrigin(), { label: 'Client' });
  await waitForHttp(`${productionClientOrigin()}/console`, {
    label: 'Console',
  });

  log.info(
    `Super-app Worker deployed (${PRODUCT_CONFIG.cloudflare.clientWorker}) on gamezilla.app / www.gamezilla.app (App + /console).`
  );
}

const dryRun = !isProductionSecretsEnv();
if (dryRun) {
  log.info('[product:deploy] dry-run (SECRETS_ENV is not prd)');
}
await deploy(dryRun);
