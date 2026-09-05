#!/usr/bin/env bun
// @io-wall-ok — composition-root wall FS via ObjectStore migration pending
import { rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { PRODUCT_CONFIG } from '@libs/db/public/product-config';
import { deleteWorkerByName } from '@libs/secrets/shared/cloudflare-worker-lifecycle';
import { productionConsoleOrigin } from '@libs/secrets/shared/deploy-origins';
import { withNodeMaxOldSpaceSize } from '@libs/secrets/shared/eas-mobile';
import { ok } from '@libs/secrets/shared/fmt';
import { REPO_ROOT } from '@libs/secrets/shared/paths';
import { runAsync, runCapture } from '@libs/secrets/shared/subprocess';
import { waitForHttp } from '@libs/secrets/shared/wait-for-http';
import { wranglerArgs, wranglerEnv } from '@libs/secrets/shared/wrangler-env';
import { assert } from '@pkgs/assert';
import { wallClock } from '@pkgs/clock';
import { assertCommitDateIso, COMMIT_HASH_HEX_REGEX } from '@pkgs/git';
import { createLogger } from '@pkgs/logger';
import { isProductionSecretsEnv } from '../../../tools/src/deploy-mode';

const log = createLogger({ name: 'console:deploy', now: wallClock.now });

const require = createRequire(import.meta.url);
const {
  EXPO_SQLITE_WEB_COEP,
  EXPO_SQLITE_WEB_COOP,
}: {
  EXPO_SQLITE_WEB_COEP: string;
  EXPO_SQLITE_WEB_COOP: string;
} = require('./expo-sqlite-web-headers.js');

const consoleDir = join(import.meta.dirname, '..');

/** Pre-cutover script names; delete after the new console worker is live. */
const LEGACY_SIM_WORKER_SCRIPT_NAMES = [
  'gamezilla-sim',
  'gamezilla-sim-production',
] as const;

function resolveCommitHash(): string {
  const rawSha = runCapture('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT });
  const commitHash = rawSha.trim().toLowerCase();
  assert.ok(
    COMMIT_HASH_HEX_REGEX.test(commitHash),
    'console-worker: git HEAD must be a valid lowercase hex commit SHA',
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

function cleanupConsoleDist(): void {
  rmSync(join(consoleDir, 'dist'), {
    recursive: true,
    force: true,
  });
}

/** COOP/COEP for SharedArrayBuffer (expo-sqlite / sqlite-wasm) on Workers assets. */
function writeDistIsolationHeaders(): void {
  const body = [
    '/*',
    `\tCross-Origin-Opener-Policy: ${EXPO_SQLITE_WEB_COOP}`,
    `\tCross-Origin-Embedder-Policy: ${EXPO_SQLITE_WEB_COEP}`,
    '',
  ].join('\n');
  writeFileSync(join(consoleDir, 'dist', '_headers'), body, 'utf8');
}

const CONSOLE_EXPORT_MAX_OLD_SPACE_MB = 8192;

async function buildConsoleWeb(
  commitHash: string,
  commitDate: string
): Promise<void> {
  const buildEnv = withNodeMaxOldSpaceSize(
    {
      ...process.env,
      EXPO_PUBLIC_COMMIT_HASH: commitHash,
      EXPO_PUBLIC_COMMIT_DATE: commitDate,
    },
    CONSOLE_EXPORT_MAX_OLD_SPACE_MB
  );

  await runAsync('bun', ['run', 'build'], {
    cwd: consoleDir,
    label: 'console-worker: expo export (static web assets)',
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
  const commitHash = resolveCommitHash();
  const commitDate = resolveCommitDate();

  await buildConsoleWeb(commitHash, commitDate);

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
