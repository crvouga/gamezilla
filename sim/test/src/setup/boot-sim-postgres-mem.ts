/**
 * Product UI-sim postgres-mem boot: wraps `@pkgs/sql-client` seeded PGMM with
 * this package's cache/fingerprint paths.
 */

import { join } from 'node:path';
import {
  migrateSimPostgres,
  SIM_BETTER_AUTH_SECRET,
} from '@apps/server/sim/migrate-sim-postgres';
import type { Clock } from '@pkgs/clock';
import { wallClock } from '@pkgs/clock';
import { readUtf8 } from '@pkgs/object-store/helpers';
import { createNodeFsObjectStore } from '@pkgs/object-store/impl-node-fs';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { wallNodeFs } from '@pkgs/object-store/wall-node-fs';
import {
  computeSimPostgresMemSeedFingerprint,
  ensureSimPostgresMemSeedBuffer,
  openSimPostgresMemFromSeed,
  type SimPostgresMemSqlBundle,
} from '@pkgs/sql-client/postgres/boot-sim-postgres-mem';
import type { SimSqlHandle } from '@sim/console/sim/sim-sql';

const CACHE_DIR = join(__dirname, '../../.cache');
const SEED_KEY = 'sim-backend-seed.pgmm.json';
export const SIM_SEED_PGMM_PATH = join(CACHE_DIR, SEED_KEY);

const MIGRATE_SOURCE_KEY = 'migrate-sim-postgres.ts';

function createSimPostgresMemCacheStore(): ObjectStore {
  return createNodeFsObjectStore({
    rootDir: CACHE_DIR,
    fs: wallNodeFs(),
    layout: 'tree',
  });
}

function createMigrateSourceStore(): ObjectStore {
  return createNodeFsObjectStore({
    rootDir: join(__dirname, '../../../../apps/server/src/sim'),
    fs: wallNodeFs(),
    layout: 'tree',
  });
}

async function fingerprintSource(): Promise<Buffer> {
  const text = await readUtf8(createMigrateSourceStore(), MIGRATE_SOURCE_KEY);
  if (text === null) {
    throw new Error(`missing migrate source: ${MIGRATE_SOURCE_KEY}`);
  }
  // Include auth secret constant so seed rebuilds if it changes.
  return Buffer.from(`${text}\n${SIM_BETTER_AUTH_SECRET}`);
}

/** Fingerprint of migrate inputs — rebuild seed when this changes. */
export async function computeSimPostgresMemSeedFp(): Promise<string> {
  return computeSimPostgresMemSeedFingerprint({
    fingerprintSource: await fingerprintSource(),
  });
}

/**
 * Ensure disk + process seed matches fingerprint. Rebuilds via migrate when
 * missing or stale. Safe to call from Jest globalSetup / `seed:sim-db`.
 */
export async function ensureSimPostgresMemSeed(): Promise<{
  readonly seedBytes: Uint8Array;
  readonly didMigrate: boolean;
}> {
  return ensureSimPostgresMemSeedBuffer({
    store: createSimPostgresMemCacheStore(),
    seedKey: SEED_KEY,
    fingerprintSource: await fingerprintSource(),
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
 * Open a SimSqlHandle from the cached post-migrate PGMM seed (no migrate).
 * Call {@link ensureSimPostgresMemSeed} first (globalSetup) or rely on lazy ensure.
 */
export async function openSeededSimServerSql(
  logicalName: string,
  clock: Clock
): Promise<SimSqlHandle> {
  const { seedBytes } = await ensureSimPostgresMemSeed();
  let databaseName = uniqueName(logicalName);
  let live: SimPostgresMemSqlBundle = openSimPostgresMemFromSeed({
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
      live = openSimPostgresMemFromSeed({ seedBytes, clock });
      await live.sqlClient.connect();
      await prev.disconnect();
    },
    exportBytes: async () => live.exportBytes(),
    importBytes: async (bytes) => {
      live.importBytes(bytes);
    },
  };
}
