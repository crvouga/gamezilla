import { API_SYNC_TABLE_REGISTRY } from '@apps/api/sync/table-registry';
import { createPowerSyncSchema } from '@pkgs/sync-engine-powersync/client/schema-from-registry';
import type { PowerSyncDatabasePort } from '@pkgs/sync-engine-powersync/client/powersync-database-port';
import { Platform } from 'react-native';

import { getMainSqliteDbName } from '../storage/open-main-sql-client';

const POWERSYNC_WEB_ASSET_PREFIX = '/generated/powersync/@powersync';

const schema = createPowerSyncSchema(API_SYNC_TABLE_REGISTRY);

type SdkDatabase = PowerSyncDatabasePort & {
  connect(connector: unknown): Promise<void>;
};

function createWebDatabase(): SdkDatabase {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- platform split
  const web = require('@powersync/web/umd');
  const enableMultiTabs = typeof SharedWorker !== 'undefined';
  const factory = new web.WASQLiteOpenFactory({
    dbFilename: `${getMainSqliteDbName()}.db`,
    vfs: web.WASQLiteVFS.OPFSCoopSyncVFS,
    worker: `${POWERSYNC_WEB_ASSET_PREFIX}/worker/WASQLiteDB.umd.js`,
    flags: { enableMultiTabs },
  });
  return new web.PowerSyncDatabase({
    schema,
    database: factory,
    sync: {
      worker: `${POWERSYNC_WEB_ASSET_PREFIX}/worker/SharedSyncImplementation.umd.js`,
    },
    flags: { enableMultiTabs },
  }) as unknown as SdkDatabase;
}

function createNativeDatabase(): SdkDatabase {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- platform split
  const native = require('@powersync/react-native');
  return new native.PowerSyncDatabase({
    schema,
    database: { dbFilename: `${getMainSqliteDbName()}.db` },
  }) as unknown as SdkDatabase;
}

/** Opens the platform PowerSync SQLite database (native RN or web wa-sqlite). */
export function createPowerSyncDatabase(): SdkDatabase {
  return Platform.OS === 'web' ? createWebDatabase() : createNativeDatabase();
}
