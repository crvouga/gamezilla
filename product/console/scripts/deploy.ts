#!/usr/bin/env bun
// @io-wall-ok — composition-root wall FS via ObjectStore migration pending
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PRODUCT_CONFIG } from '@libs/db/public/product-config';
import { deleteWorkerByName } from '@libs/secrets/shared/cloudflare-worker-lifecycle';
import { productionConsoleOrigin } from '@libs/secrets/shared/deploy-origins';
import { ok } from '@libs/secrets/shared/fmt';
import { withNodeMaxOldSpaceSize } from '@libs/secrets/shared/node-options';
import { runAsync } from '@libs/secrets/shared/subprocess';
import { waitForHttp } from '@libs/secrets/shared/wait-for-http';
import { wranglerArgs, wranglerEnv } from '@libs/secrets/shared/wrangler-env';
import { wallClock } from '@pkgs/clock';
import { createLogger } from '@pkgs/logger';
import { isProductionSecretsEnv } from '../../../tools/src/deploy-mode';

const log = createLogger({ name: 'console:deploy', now: wallClock.now });

const consoleDir = join(import.meta.dirname, '..');

/** COOP/COEP for SharedArrayBuffer (sqlite-wasm OPFS SAH pool) on Workers assets. */
const SQLITE_WEB_COOP = 'same-origin';
const SQLITE_WEB_COEP = 'require-corp';

/** Pre-cutover script names; delete after the new console worker is live. */
const LEGACY_SIM_WORKER_SCRIPT_NAMES = [
  'gamezilla-sim',
  'gamezilla-sim-production',
] as const;

function cleanupConsoleDist(): void {
  rmSync(join(consoleDir, 'dist'), {
    recursive: true,
    force: true,
  });
}

/** COOP/COEP for SharedArrayBuffer (sqlite-wasm) on Workers assets. */
function writeDistIsolationHeaders(): void {
  const body = [
    '/*',
    `\tCross-Origin-Opener-Policy: ${SQLITE_WEB_COOP}`,
    `\tCross-Origin-Embedder-Policy: ${SQLITE_WEB_COEP}`,
    '',
  ].join('\n');
  writeFileSync(join(consoleDir, 'dist', '_headers'), body, 'utf8');
}

const CONSOLE_EXPORT_MAX_OLD_SPACE_MB = 8192;

async function buildConsoleWeb(): Promise<void> {
  const buildEnv = withNodeMaxOldSpaceSize(
    { ...process.env },
    CONSOLE_EXPORT_MAX_OLD_SPACE_MB
  );

  await runAsync('bun', ['run', 'build'], {
    cwd: consoleDir,
    label: 'console-worker: vite build (static web assets)',
    env: buildEnv,
  });

  writeDistIsolationHeaders();
}

function deleteLegacySimWorkerScripts(): void {
  for (const name of LEGACY_SIM_WORKER_SCRIPT_NAMES) {
    deleteWorkerByName(name);
  }
}

async function deploy(dryRun: boolean): Promise<void> {
  await buildConsoleWeb();

  const wranglerDeployArgs = dryRun
    ? wranglerArgs('deploy', '--dry-run')
    : wranglerArgs('deploy');
  const label = dryRun
    ? 'console-worker: Cloudflare Workers deploy (dry-run)'
    : 'console-worker: Cloudflare Workers deploy (static assets)';

  try {
    await runAsync('wrangler', wranglerDeployArgs, {
      cwd: consoleDir,
      env: wranglerEnv(),
      label,
    });
  } finally {
    cleanupConsoleDist();
  }

  if (dryRun) {
    ok(
      'console-worker dry-run',
      'console bundle + assets-only worker validated'
    );
    return;
  }

  deleteLegacySimWorkerScripts();

  await waitForHttp(productionConsoleOrigin(), { label: 'Console' });

  log.info(
    `Console Worker deployed (${PRODUCT_CONFIG.cloudflare.consoleWorker}) on console.gamezilla.app.`
  );
}

const dryRun = !isProductionSecretsEnv();
if (dryRun) {
  log.info('[console:deploy] dry-run (SECRETS_ENV is not prd)');
}
await deploy(dryRun);
