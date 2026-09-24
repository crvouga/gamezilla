/**
 * Product UI-sim mockingbird-postgres boot: wraps `@pkgs/sql-client` seeded PGMM with
 * this package's cache/fingerprint paths.
 */

import { join } from 'node:path';
import type { SimSql } from '@apps/product/sim/fabric/sim-sql';
import { migrateSimPostgres } from '@apps/server/sim/migrate-sim-postgres';
import type { Clock } from '@pkgs/clock';
import { wallClock } from '@pkgs/clock';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs/wall-node-fs';
import {
  computeSimMockingbirdPostgresSeedFingerprint,
  ensureSimMockingbirdPostgresSeedBuffer,
  openSimMockingbirdPostgresFromSeed,
  type SimMockingbirdPostgresSqlBundle,
} from '@pkgs/sql-client-sim/boot-sim-mockingbird-postgres';

import { simPostgresSeedFingerprintSource } from './sim-postgres-seed-fingerprint';

const CACHE_DIR = join(__dirname, '../../../.cache');
const SEED_KEY = 'sim-backend-seed.pgmm.json';
export const SIM_SEED_PGMM_PATH = join(CACHE_DIR, SEED_KEY);

const REPO_ROOT = join(__dirname, '../../../../..');

/** Fingerprint of migrate inputs — rebuild seed when this changes. */
export async function computeSimMockingbirdPostgresSeedFp(): Promise<string> {
  return computeSimMockingbirdPostgresSeedFingerprint({
    fingerprintSource: await simPostgresSeedFingerprintSource(REPO_ROOT),
  });
}

/**
 * Ensure disk + process seed matches fingerprint. Rebuilds via migrate when
 * missing or stale. Safe to call from Jest globalSetup / `seed:sim-db`.
 */
export async function ensureSimMockingbirdPostgresSeed(): Promise<{
  readonly seedBytes: Uint8Array;
  readonly didMigrate: boolean;
}> {
  return ensureSimMockingbirdPostgresSeedBuffer({
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
 * Open a SimSql from the cached post-migrate PGMM seed (no migrate).
 * Call {@link ensureSimMockingbirdPostgresSeed} first (globalSetup) or rely on lazy ensure.
 */
export async function openSeededSimServerSql(
  logicalName: string,
  clock: Clock
): Promise<SimSql> {
  const { seedBytes } = await ensureSimMockingbirdPostgresSeed();
  let databaseName = uniqueName(logicalName);
  let live: SimMockingbirdPostgresSqlBundle =
    openSimMockingbirdPostgresFromSeed({
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
      live = openSimMockingbirdPostgresFromSeed({ seedBytes, clock });
      await live.sqlClient.connect();
      await prev.disconnect();
    },
    exportBytes: () => Promise.resolve(live.exportBytes()),
    importBytes: (bytes) => {
      live.importBytes(bytes);
      return Promise.resolve();
    },
  };
}
