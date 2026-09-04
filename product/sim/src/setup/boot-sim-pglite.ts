/**
 * Product UI-sim PGlite boot: wraps `@pkgs/sql-client` seeded dump with
 * this package's cache/fingerprint paths.
 */

import { join } from 'node:path';
import { migrateSimPostgres } from '@apps/server/sim/migrate-sim-postgres';
import type { Clock } from '@pkgs/clock';
import { wallClock } from '@pkgs/clock';
import { createNodeFsObjectStore } from '@pkgs/object-store/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store/wall-node-fs';
import {
  computeSimPgliteSeedFingerprint,
  ensureSimPgliteSeedBuffer,
  openSimPgliteFromSeed,
  type SimPgliteSqlBundle,
} from '@pkgs/sql-client/postgres/boot-sim-pglite';
import type { SimSql } from '@product/sim/fabric/sim-sql';

import { simPostgresSeedFingerprintSource } from './sim-postgres-seed-fingerprint';

const CACHE_DIR = join(__dirname, '../../../test/.cache');
const SEED_KEY = 'sim-backend-seed.pglite.bin';
export const SIM_SEED_PGLITE_PATH = join(CACHE_DIR, SEED_KEY);

const REPO_ROOT = join(__dirname, '../../../..');

export async function computeSimPgliteSeedFp(): Promise<string> {
  return computeSimPgliteSeedFingerprint({
    fingerprintSource: await simPostgresSeedFingerprintSource(REPO_ROOT),
  });
}

/**
 * Ensure disk + process seed matches fingerprint. Rebuilds via migrate when
 * missing or stale. Safe to call from Jest globalSetup / `seed:sim-db`.
 */
export async function ensureSimPgliteSeed(): Promise<{
  readonly seedBytes: Uint8Array;
  readonly didMigrate: boolean;
}> {
  return ensureSimPgliteSeedBuffer({
    store: createNodeFsObjectStore({
      rootDir: CACHE_DIR,
      fs: wallNodeFs(),
      layout: 'tree',
    }),
    seedKey: SEED_KEY,
    fingerprintSource: await simPostgresSeedFingerprintSource(REPO_ROOT),
    now: wallClock.now,
    migrate: async ({ sqlClient, pool }) => {
      await migrateSimPostgres({
        sqlClient,
        pool,
        now: wallClock.now,
      });
    },
  });
}

let simSqlSeq = 0;

function uniqueName(base: string): string {
  simSqlSeq += 1;
  const safe = base.replace(/[^a-zA-Z0-9_]/g, '_');
  return `${safe}_${simSqlSeq}`;
}

/**
 * Open a SimSql from the cached post-migrate PGlite seed (no migrate).
 */
export async function openSeededSimServerSqlPglite(
  logicalName: string,
  clock: Clock
): Promise<SimSql> {
  const { seedBytes } = await ensureSimPgliteSeed();
  let databaseName = uniqueName(logicalName);
  let live: SimPgliteSqlBundle = await openSimPgliteFromSeed({
    seedBytes,
    clock,
  });
  await live.sqlClient.connect();
  return {
    get sqlClient() {
      return live.sqlClient;
    },
    get databaseName() {
      return databaseName;
    },
    get pool() {
      return live.pool;
    },
    disconnect: () => live.disconnect(),
    reset: async () => {
      const prev = live;
      databaseName = uniqueName(logicalName);
      live = await openSimPgliteFromSeed({ seedBytes, clock });
      await live.sqlClient.connect();
      await prev.disconnect();
    },
    exportBytes: () => live.exportBytes(),
    importBytes: (bytes) => live.replaceFromBytes(bytes),
  };
}
