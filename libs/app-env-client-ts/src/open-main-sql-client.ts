/**
 * Browser local SQLite: multi-tab-safe OPFS broker from
 * `@pkgs/sql-client-sqlite-web`. Local sync schema migration runs after open.
 * Database naming lives in `./main-sqlite-db-name`.
 */

import { getMainSqliteDbName } from '@libs/app-root-shared-ts/main-sqlite-db-name';
import { technicalName } from '@libs/product-identity-shared-ts/technical-names';
import type { Timers } from '@pkgs/clock-shared-ts/types';
import type { Logger } from '@pkgs/logger-shared-ts/logger';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { createWebSqlClient } from '@pkgs/sql-client-sqlite-web-client-ts/web-sql-client';
import {
  LOCAL_DATABASE,
  recordLocalDatabaseOpen,
  traceBrowserStartup,
} from './browser-boundaries';

/**
 * The BroadcastChannel on which local-data recovery asks every open tab to
 * drop its OPFS handles. Derived from the immutable technical namespace, so
 * it is the same in every version of the app: a tab still running an older
 * version hears a newer tab's request.
 */
export const OPFS_WIPE_CHANNEL = technicalName(['opfs', 'wipe']);

export type CreateWebSqlClient = (
  dbName: string,
  options: {
    readonly timers: Timers;
    readonly logger: Logger;
    readonly wipeChannel: string;
  }
) => SqlClient;

export async function openMainSqlClient(
  userId: string,
  timers: Timers,
  logger: Logger,
  createClient: CreateWebSqlClient = createWebSqlClient
): Promise<SqlClient> {
  let client: SqlClient | undefined;
  try {
    const opened = createClient(getMainSqliteDbName(userId), {
      timers,
      logger,
      wipeChannel: OPFS_WIPE_CHANNEL,
    });
    client = opened;
    await traceBrowserStartup('db.connect', () => opened.connect());
    recordLocalDatabaseOpen(LOCAL_DATABASE.worker);
    return opened;
  } catch (error) {
    void client?.disconnect().catch(() => undefined);
    recordLocalDatabaseOpen(LOCAL_DATABASE.worker, error);
    throw error;
  }
}
