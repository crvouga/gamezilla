#!/usr/bin/env bun
// @io-wall-ok — deploy CLI entry.
/**
 * Super-app deploy for the environment in `SECRETS_ENV`: Vite build of
 * `@apps/product` (App at `/`, Harness at `/harness`) against that
 * environment's API, then one version with assets, API and rooms. Hostnames are bound by
 * the OpenTofu edge stack afterwards; `health` checks they serve.
 */
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assertRoomNamespacePreserved,
  roomMigrations,
} from '@libs/infra-shared/worker-lifecycle';
import { ok } from '@libs/secrets-server/fmt';
import { REPO_ROOT } from '@libs/secrets-server/paths';
import { runAsync, runCapture } from '@libs/secrets-server/subprocess';
import { withNodeMaxOldSpaceSize } from '@libs/secrets-shared/node-options';
import { assert } from '@pkgs/assert-shared/singleton';
import {
  assertCommitDateIso,
  COMMIT_HASH_HEX_REGEX,
} from '@pkgs/git-shared/git';
import {
  activeEnvFile,
  deployWorker,
} from '../../../libs/infra-server/scripts/worker-deploy';
import { workerState } from '../../../libs/infra-shared/scripts/worker-state';
import { hyperdriveId, workerSecrets } from './worker-secrets';

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
    ['run', 'check:live-env', '--', `--expected-origin=${apiUrl}`],
    {
      cwd: productDir,
      label: 'product-worker: live build env gate',
      env: buildEnv,
    }
  );

  await runAsync('bun', ['run', 'build'], {
    cwd: productDir,
    label: 'product-worker: Vite build (static web assets)',
    env: buildEnv,
  });

  writeDistIsolationHeaders();

  await runAsync(
    'bun',
    ['run', 'check:live-dist', '--', `--expected-origin=${apiUrl}`],
    {
      cwd: productDir,
      label: 'product-worker: live web dist API URL gate',
      env: buildEnv,
    }
  );
}

const commitHash = resolveCommitHash();
await buildProductWeb(commitHash, resolveCommitDate());
try {
  const env = activeEnvFile();
  const secrets = { ...(await workerSecrets()), BUILD_SHA: commitHash };
  const state = workerState(env);
  const before = await state.namespaces();
  const migration = roomMigrations(env, before);
  deployWorker({
    appDir: productDir,
    secrets,
    resources: { hyperdriveId: hyperdriveId(), roomMigrations: migration },
  });
  assertRoomNamespacePreserved(env, before, await state.namespaces());
} finally {
  cleanupProductDist();
}
ok(
  'Application Worker',
  `deployed to ${activeEnvFile().env} (${commitHash.slice(0, 12)})`
);
