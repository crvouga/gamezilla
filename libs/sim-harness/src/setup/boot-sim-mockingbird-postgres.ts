/**
 * Sim mockingbird-postgres boot: one migrated PGMM dump per composition, cached under
 * the running package's `.cache/` and rebuilt when its fingerprint changes.
 */

import { join } from 'node:path';
import { wallClock } from '@pkgs/clock';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs/wall-node-fs';
import {
  computeSimMockingbirdPostgresSeedFingerprint,
  ensureSimMockingbirdPostgresSeedBuffer,
} from '@pkgs/sql-client-sim/boot-sim-mockingbird-postgres';
import type { SimComposition } from '../composition';
import { compositionMigratePostgres } from '../migrate/migrate-composition';
import { simPostgresSeedFingerprintSource } from './sim-postgres-seed-fingerprint';

const REPO_ROOT = join(__dirname, '../../../..');

/** The running package's cache: each test task writes only its own tree. */
function cacheDir(): string {
  return join(process.cwd(), '.cache');
}

function seedKey(composition: SimComposition): string {
  return `sim-seed-${composition.name}.pgmm.json`;
}

export function simSeedPgmmPath(composition: SimComposition): string {
  return join(cacheDir(), seedKey(composition));
}

/** Fingerprint of migrate inputs — rebuild seed when this changes. */
export async function computeSimMockingbirdPostgresSeedFp(
  composition: SimComposition
): Promise<string> {
  return computeSimMockingbirdPostgresSeedFingerprint({
    fingerprintSource: await simPostgresSeedFingerprintSource(
      REPO_ROOT,
      composition
    ),
  });
}

/**
 * Ensure disk + process seed matches fingerprint. Rebuilds via migrate when
 * missing or stale; the first sim of a composition in a process pays for it.
 */
export async function ensureSimMockingbirdPostgresSeed(
  composition: SimComposition
): Promise<{
  readonly seedBytes: Uint8Array;
  readonly didMigrate: boolean;
}> {
  return ensureSimMockingbirdPostgresSeedBuffer({
    store: createNodeFsObjectStore({
      rootDir: cacheDir(),
      fs: wallNodeFs(),
      layout: 'tree',
    }),
    seedKey: seedKey(composition),
    fingerprintSource: await simPostgresSeedFingerprintSource(
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
