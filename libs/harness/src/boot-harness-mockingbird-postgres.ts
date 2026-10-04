/**
 * Harness mockingbird-postgres boot: one migrated PGMM dump per composition, cached under
 * the running package's `.cache/` and rebuilt when its fingerprint changes.
 */

import { join } from 'node:path';
import { wallClock } from '@pkgs/clock-shared/wall';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server/wall-node-fs';
import {
  computeHarnessMockingbirdPostgresSeedFingerprint,
  ensureHarnessMockingbirdPostgresSeedBuffer,
} from '@pkgs/sql-client-harness/boot-harness-mockingbird-postgres';
import type { HarnessComposition } from './composition';
import { compositionMigratePostgres } from './migrate-composition';
import { harnessPostgresSeedFingerprintSource } from './postgres-seed-fingerprint';

const REPO_ROOT = join(__dirname, '../../../..');

/** The running package's cache: each test task writes only its own tree. */
function cacheDir(): string {
  return join(process.cwd(), '.cache');
}

function seedKey(composition: HarnessComposition): string {
  return `harness-seed-${composition.name}.pgmm.json`;
}

export function harnessSeedPgmmPath(composition: HarnessComposition): string {
  return join(cacheDir(), seedKey(composition));
}

/** Fingerprint of migrate inputs — rebuild seed when this changes. */
export async function computeHarnessMockingbirdPostgresSeedFp(
  composition: HarnessComposition
): Promise<string> {
  return computeHarnessMockingbirdPostgresSeedFingerprint({
    fingerprintSource: await harnessPostgresSeedFingerprintSource(
      REPO_ROOT,
      composition
    ),
  });
}

/**
 * Ensure disk + process seed matches fingerprint. Rebuilds via migrate when
 * missing or stale; the first harness of a composition in a process pays for it.
 */
export async function ensureHarnessMockingbirdPostgresSeed(
  composition: HarnessComposition
): Promise<{
  readonly seedBytes: Uint8Array;
  readonly didMigrate: boolean;
}> {
  return ensureHarnessMockingbirdPostgresSeedBuffer({
    store: createNodeFsObjectStore({
      rootDir: cacheDir(),
      fs: wallNodeFs(),
      layout: 'tree',
    }),
    seedKey: seedKey(composition),
    fingerprintSource: await harnessPostgresSeedFingerprintSource(
      REPO_ROOT,
      composition
    ),
    now: wallClock.now,
    migrate: async ({ sqlClient, pool }) => {
      await compositionMigratePostgres(composition)({
        sqlClient,
        pool,
        now: wallClock.now,
      });
    },
  });
}
