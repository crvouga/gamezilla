import { SYNC_TABLE_REGISTRY } from '@libs/db/shared/table-registry';
import { createPowerSyncSchema } from '@pkgs/sync-engine-powersync/client/schema-from-registry';
import { Platform } from 'react-native';

import type { PowerSyncSdkDatabase } from './powersync-sdk-database';

export type { PowerSyncSdkDatabase } from './powersync-sdk-database';

const PS_WEB_ASSET_PREFIX = '/generated/powersync/@powersync';

const schema = createPowerSyncSchema(SYNC_TABLE_REGISTRY);

type DatabasePool = {
  readonly byName: Map<string, PowerSyncSdkDatabase>;
  activeName: string | null;
};

/**
 * Survives Metro/HMR. Keeps per-identity PowerSync DBs warm across remounts
 * (sign-in ↔ signed-out anon, or a different user after full sign-out). Only
 * one identity has sync connected at a time.
 */
function getDatabasePool(): DatabasePool {
  const g = globalThis as typeof globalThis & {
    __gamezillaPowerSyncDbPoolV6?: DatabasePool;
  };
  if (g.__gamezillaPowerSyncDbPoolV6 === undefined) {
    g.__gamezillaPowerSyncDbPoolV6 = {
      byName: new Map(),
      activeName: null,
    };
  }
  return g.__gamezillaPowerSyncDbPoolV6;
}

function createWebDatabase(dbName: string): PowerSyncSdkDatabase {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- platform split
  const web = require('@powersync/web/umd');
  const enableMultiTabs = typeof SharedWorker !== 'undefined';
  const factory = new web.WASQLiteOpenFactory({
    dbFilename: `${dbName}.db`,
    vfs: web.WASQLiteVFS.OPFSCoopSyncVFS,
    worker: `${PS_WEB_ASSET_PREFIX}/worker/WASQLiteDB.umd.js`,
    flags: { enableMultiTabs },
  });
  return new web.PowerSyncDatabase({
    schema,
    database: factory,
    sync: {
      worker: `${PS_WEB_ASSET_PREFIX}/worker/SharedSyncImplementation.umd.js`,
    },
    flags: { enableMultiTabs },
  }) as unknown as PowerSyncSdkDatabase;
}

function createNativeDatabase(dbName: string): PowerSyncSdkDatabase {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- platform split
  const native = require('@powersync/react-native');
  return new native.PowerSyncDatabase({
    schema,
    database: { dbFilename: `${dbName}.db` },
  }) as unknown as PowerSyncSdkDatabase;
}

function disconnectQuietly(database: PowerSyncSdkDatabase): void {
  try {
    void database.disconnect().catch(() => {
      // Best-effort: stop sync on the previous identity before activating another.
    });
  } catch {
    // Best-effort: stop sync on the previous identity before activating another.
  }
}

function createDatabase(databaseName: string): PowerSyncSdkDatabase {
  return Platform.OS === 'web'
    ? createWebDatabase(databaseName)
    : createNativeDatabase(databaseName);
}

/** True when this identity's DB is already the active pooled instance. */
export function isActivePowerSyncDatabase(databaseName: string): boolean {
  return getDatabasePool().activeName === databaseName;
}

/**
 * Activates the PowerSync DB for `databaseName`. Reuses a warm pooled instance
 * when present; disconnects sync on the previously active identity (keeps the
 * instance pooled for HMR / later remount). Waits for SDK `init()` so callers
 * never query a not-ready DB.
 */
export async function openPowerSyncDatabase(
  databaseName: string
): Promise<PowerSyncSdkDatabase> {
  const pool = getDatabasePool();
  if (pool.activeName === databaseName) {
    const current = pool.byName.get(databaseName);
    if (current !== undefined) {
      await current.init();
      return current;
    }
  }
  if (pool.activeName !== null && pool.activeName !== databaseName) {
    const previous = pool.byName.get(pool.activeName);
    if (previous !== undefined) {
      disconnectQuietly(previous);
    }
  }
  let database = pool.byName.get(databaseName);
  if (database === undefined) {
    database = createDatabase(databaseName);
    pool.byName.set(databaseName, database);
  }
  pool.activeName = databaseName;
  await database.init();
  return database;
}
