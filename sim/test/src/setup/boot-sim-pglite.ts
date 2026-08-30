/**
 * Product UI-sim PGlite boot: wraps `@pkgs/sql-client` seeded dump with
 * this package's cache/fingerprint paths.
 */

import { join } from 'node:path';
import {
  migrateSimPostgres,
  SIM_AUTH_SECRET,
} from '@apps/server/sim/migrate-sim-postgres';
import type { Clock } from '@pkgs/clock';
import { wallClock } from '@pkgs/clock';
import { readUtf8 } from '@pkgs/object-store/helpers';
import { createNodeFsObjectStore } from '@pkgs/object-store/impl-node-fs';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { wallNodeFs } from '@pkgs/object-store/wall-node-fs';
import {
  computeSimPgliteSeedFingerprint,
  ensureSimPgliteSeedBuffer,
  openSimPgliteFromSeed,
  type SimPgliteSqlBundle,
} from '@pkgs/sql-client/postgres/boot-sim-pglite';
import type { SimSqlHandle } from '@sim/console/sim/sim-sql';

const CACHE_DIR = join(__dirname, '../../.cache');
const SEED_KEY = 'sim-backend-seed.pglite.bin';
export const SIM_SEED_PGLITE_PATH = join(CACHE_DIR, SEED_KEY);

const MIGRATE_SOURCE_KEY = 'migrate-sim-postgres.ts';

function createSimPgliteCacheStore(): ObjectStore {
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
  return Buffer.from(`${text}\n${SIM_AUTH_SECRET}`);
}

export async function computeSimPgliteSeedFp(): Promise<string> {
  return computeSimPgliteSeedFingerprint({
    fingerprintSource: await fingerprintSource(),
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
    store: createSimPgliteCacheStore(),
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
 * Open a SimSqlHandle from the cached post-migrate PGlite seed (no migrate).
 */
export async function openSeededSimServerSqlPglite(
  logicalName: string,
  clock: Clock
): Promise<SimSqlHandle> {
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
