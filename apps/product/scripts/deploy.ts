#!/usr/bin/env bun
// @io-wall-ok — deploy CLI entry.
/**
 * Super-app deploy for the environment in `SECRETS_ENV`: Vite build of
 * `@apps/product` (App at `/`, Simulator at `/simulator`) against that
 * environment's API, then the assets-only Worker. Its hostnames are bound by
 * the OpenTofu edge stack afterwards; `health` checks they serve.
 */
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { activeEnvFile, deployWorker } from '@libs/infra/scripts/worker-deploy';
import { ok } from '@libs/secrets/shared/fmt';
import { withNodeMaxOldSpaceSize } from '@libs/secrets/shared/node-options';
import { REPO_ROOT } from '@libs/secrets/shared/paths';
import { runAsync, runCapture } from '@libs/secrets/shared/subprocess';
import { assert } from '@pkgs/assert';
import { assertCommitDateIso, COMMIT_HASH_HEX_REGEX } from '@pkgs/git';

const productDir = join(import.meta.dirname, '..');

/** COOP/COEP for SharedArrayBuffer (sqlite-wasm OPFS SAH pool) on Workers assets. */
const SQLITE_WEB_COOP = 'same-origin';
const SQLITE_WEB_COEP = 'require-corp';

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
    '/sso-callback',
    '\tCross-Origin-Opener-Policy: same-origin-allow-popups',
    '',
  ].join('\n');
  writeFileSync(join(productDir, 'dist', '_headers'), body, 'utf8');
}

async function buildProductWeb(
  commitHash: string,
  commitDate: string
): Promise<void> {
  const apiUrl = `https://${activeEnvFile().hosts.api}`;
  const buildEnv = withNodeMaxOldSpaceSize(
    {
      ...process.env,
      VITE_API_URL: apiUrl,
      VITE_COMMIT_HASH: commitHash,
      VITE_COMMIT_DATE: commitDate,
    },
    PRODUCT_EXPORT_MAX_OLD_SPACE_MB
  );

  await runAsync(
    'bun',
    ['run', 'check:production-env', '--', `--expected-origin=${apiUrl}`],
    {
      cwd: productDir,
      label: 'product-worker: production build env gate',
      env: buildEnv,
    }
  );

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

const commitHash = resolveCommitHash();
await buildProductWeb(commitHash, resolveCommitDate());
try {
  deployWorker({ appDir: productDir, role: 'web', secrets: {} });
} finally {
  cleanupProductDist();
}
ok(
  'Super-app Worker',
  `deployed to ${activeEnvFile().env} (${commitHash.slice(0, 12)})`
);
