#!/usr/bin/env bun
// @io-wall-ok — deploy CLI entry.
/**
 * Super-app deploy for the environment in `SECRETS_ENV`: one version with
 * assets, API and rooms. The assets are the ones Turbo's
 * `@apps/product-ts#build` left in `dist`, built for this environment's API
 * and commit, which this release's `verify:*` tasks already checked; they
 * are deployed as they are, never rebuilt. Hostnames are bound by the
 * OpenTofu edge stack afterwards; `health:release` checks they serve.
 */
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assertRoomNamespacePreserved,
  roomMigrations,
} from '@libs/infra-shared-ts/worker-lifecycle';
import { ok } from '@libs/secrets-server-ts/fmt';
import { REPO_ROOT } from '@libs/secrets-server-ts/paths';
import { runAsync, runCapture } from '@libs/secrets-server-ts/subprocess';
import {
  hyperdriveId,
  workerSecrets,
} from '@libs/secrets-server-ts/worker-secrets';
import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { COMMIT_HASH_HEX_REGEX } from '@pkgs/git-shared-ts/git';
import {
  activeEnvFile,
  deployWorker,
} from '../../../libs/infra-server-ts/scripts/worker-deploy';
import { workerState } from '../../../libs/infra-shared-ts/scripts/worker-state';
import { assertDistBuiltFor } from './dist-commit';
import { distHeadersFile } from './dist-headers';

const productDir = join(import.meta.dirname, '..');

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

function cleanupProductDist(): void {
  removeTree(join(productDir, 'dist'));
}

function writeDistHeaders(): void {
  const dist = join(productDir, 'dist');
  const files = readdirSync(dist, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      join(entry.parentPath, entry.name)
        .slice(dist.length + 1)
        .replaceAll('\\', '/')
    );
  writeFileSync(join(dist, '_headers'), distHeadersFile(files), 'utf8');
}

async function checkBuiltWeb(commitHash: string): Promise<void> {
  const apiUrl = `https://${activeEnvFile().hosts.api}`;
  assertDistBuiltFor(join(productDir, 'dist'), commitHash);
  writeDistHeaders();
  await runAsync(
    'bun',
    ['run', 'verify:live-dist', '--', `--expected-origin=${apiUrl}`],
    {
      cwd: productDir,
      label: 'product-worker: live web dist API URL gate',
    }
  );
}

const commitHash = resolveCommitHash();
try {
  await checkBuiltWeb(commitHash);
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
  `released to ${activeEnvFile().env} (${commitHash.slice(0, 12)})`
);
