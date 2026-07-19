import { SYNC_TABLE_REGISTRY } from '@libs/db/shared/table-registry';
import { createPowerSyncSchema } from '@pkgs/sync-engine-powersync/client/schema-from-registry';
import { Platform } from 'react-native';

import type { PowerSyncSdkDatabase } from './powersync-sdk-database';

export type { PowerSyncSdkDatabase } from './powersync-sdk-database';

const PS_WEB_ASSET_PREFIX = '/generated/powersync/@powersync';

const schema = createPowerSyncSchema(SYNC_TABLE_REGISTRY);

type ActiveDatabase = {
  readonly name: string;
  readonly database: PowerSyncSdkDatabase;
};

type ActiveSlot = {
  current: ActiveDatabase | null;
  replaceChain: Promise<void>;
};

/**
 * Survives Metro/HMR so a remounted module can disconnect the previous
 * PowerSync worker before opening a new identity file (avoids OPFS
 * `sqlite3_open_v2` failures from zombie workers).
 */
function getActiveSlot(): ActiveSlot {
  const g = globalThis as typeof globalThis & {
    __gamezillaActivePowerSyncDb?: ActiveSlot;
  };
  if (g.__gamezillaActivePowerSyncDb === undefined) {
    g.__gamezillaActivePowerSyncDb = {
      current: null,
      replaceChain: Promise.resolve(),
    };
  }
  return g.__gamezillaActivePowerSyncDb;
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

async function disconnectQuietly(
  database: PowerSyncSdkDatabase
): Promise<void> {
  try {
    await database.disconnect();
  } catch {
    // Best-effort teardown before opening the next identity file.
  }
}

/**
 * Opens the PowerSync DB for `databaseName`. Disconnects any previous active
 * DB first — only one OPFS-backed PowerSync instance may be live at a time.
 */
export async function openPowerSyncDatabase(
  databaseName: string
): Promise<PowerSyncSdkDatabase> {
  const slot = getActiveSlot();
  const run = slot.replaceChain.then(async () => {
    if (slot.current !== null && slot.current.name === databaseName) {
      return slot.current.database;
    }
    if (slot.current !== null) {
      await disconnectQuietly(slot.current.database);
      slot.current = null;
    }
    const database =
      Platform.OS === 'web'
        ? createWebDatabase(databaseName)
        : createNativeDatabase(databaseName);
    slot.current = { name: databaseName, database };
    return database;
  });
  slot.replaceChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}
