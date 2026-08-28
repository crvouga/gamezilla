#!/usr/bin/env bun
// @io-wall-ok — composition-root wall FS via ObjectStore migration pending
import { rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { PRODUCT_CONFIG } from '@libs/db/public/product-config';
import { withNodeMaxOldSpaceSize } from '@libs/secrets/shared/eas-mobile';
import { ok } from '@libs/secrets/shared/fmt';
import { REPO_ROOT } from '@libs/secrets/shared/paths';
import { runAsync, runCapture } from '@libs/secrets/shared/subprocess';
import { wranglerArgs, wranglerEnv } from '@libs/secrets/shared/wrangler-env';
import { assert } from '@pkgs/assert';
import { assertCommitDateIso, COMMIT_HASH_HEX_REGEX } from '@pkgs/git';
import { isProductionSecretsEnv } from '../../../tools/src/deploy-mode';

const require = createRequire(import.meta.url);
const {
  EXPO_SQLITE_WEB_COEP,
  EXPO_SQLITE_WEB_COOP,
}: {
  EXPO_SQLITE_WEB_COEP: string;
  EXPO_SQLITE_WEB_COOP: string;
} = require('./expo-sqlite-web-headers.js');

const simDir = join(import.meta.dirname, '..');

function resolveCommitHash(): string {
  const rawSha = runCapture('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT });
  const commitHash = rawSha.trim().toLowerCase();
  assert.ok(
    COMMIT_HASH_HEX_REGEX.test(commitHash),
    'sim-worker: git HEAD must be a valid lowercase hex commit SHA',
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

function cleanupSimDist(): void {
  rmSync(join(simDir, 'dist'), {
    recursive: true,
    force: true,
  });
}

/** COOP/COEP for SharedArrayBuffer (expo-sqlite / PGlite) on Workers assets. */
function writeDistIsolationHeaders(): void {
  const body = [
    '/*',
    `\tCross-Origin-Opener-Policy: ${EXPO_SQLITE_WEB_COOP}`,
    `\tCross-Origin-Embedder-Policy: ${EXPO_SQLITE_WEB_COEP}`,
    '',
  ].join('\n');
  writeFileSync(join(simDir, 'dist', '_headers'), body, 'utf8');
}

const SIM_EXPORT_MAX_OLD_SPACE_MB = 8192;

async function buildSimWeb(
  commitHash: string,
  commitDate: string
): Promise<void> {
  const buildEnv = withNodeMaxOldSpaceSize(
    {
      ...process.env,
      EXPO_PUBLIC_COMMIT_HASH: commitHash,
      EXPO_PUBLIC_COMMIT_DATE: commitDate,
    },
    SIM_EXPORT_MAX_OLD_SPACE_MB
  );

  await runAsync('bun', ['run', 'build'], {
    cwd: simDir,
    label: 'sim-worker: expo export (static web assets)',
    env: buildEnv,
  });

  writeDistIsolationHeaders();
}

async function deploy(dryRun: boolean): Promise<void> {
  const commitHash = resolveCommitHash();
  const commitDate = resolveCommitDate();

  await buildSimWeb(commitHash, commitDate);

  const wranglerDeployArgs = dryRun
    ? wranglerArgs('deploy', '--dry-run')
    : wranglerArgs('deploy');
  const label = dryRun
    ? 'sim-worker: Cloudflare Workers deploy (dry-run)'
    : 'sim-worker: Cloudflare Workers deploy (static assets)';

  try {
    await runAsync('wrangler', wranglerDeployArgs, {
      cwd: simDir,
      env: wranglerEnv(),
      label,
    });
  } finally {
    cleanupSimDist();
  }

  if (dryRun) {
    ok(
      'sim-worker dry-run',
      'sim console bundle + assets-only worker validated'
    );
    return;
  }

  console.log(
    `Sim Worker deployed (${PRODUCT_CONFIG.cloudflare.simWorker}) on sim.gamezilla.app.`
  );
}

const dryRun = !isProductionSecretsEnv();
if (dryRun) {
  console.log('[sim:deploy] dry-run (SECRETS_ENV is not prd)');
}
await deploy(dryRun);
