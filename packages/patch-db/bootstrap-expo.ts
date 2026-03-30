import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { DependencyInjectionContainer } from '@gamezilla/shared/dependency-injection/dependency-injection-container';
import { InMemoryPubSub } from '@gamezilla/shared/pub-sub/impl-in-memory';
import { SqlClientImplExpoSqlite } from '@gamezilla/shared/sql-client/impl-expo-sqlite';
import type { SqlClient } from '@gamezilla/shared/sql-client/interface';
import { assertPatchDbSyncServerBaseUrl } from './assert-sync-server-base-url';
import { PatchDbImplClientTransport } from './impl-client-transport';
import { PatchDbImplSqlite } from './impl-sqlite/impl-sqlite';
import { SyncPatchesDb } from './impl-sync';
import { PatchesDbToken } from './react';
import { SubscribablePatchesDbToken } from './subscribable';
import { PatchDbClientTransportHttpFetch } from './transport';

export type BootstrapResult = {
  container: DependencyInjectionContainer;
};

export type BootstrapPatchDbExpoSyncOptions = {
  databaseName?: string;
  /** Absolute URL including patch-db base path, e.g. `https://host/patch-db`. */
  apiUrl: string;
  pushIntervalMs?: number;
  parentContainer?: DependencyInjectionContainer;
};

/** On web, expo-sqlite uses File System API which allows only one access handle per file.
 * Caching the bootstrap promise prevents NoModificationAllowedError from Strict Mode double-mount or hot reload. */
let cachedBootstrap: { key: string; promise: Promise<BootstrapResult> } | null =
  null;
let currentSqlClient: SqlClient | null = null;

export async function bootstrapPatchDbExpoSync(
  options: BootstrapPatchDbExpoSyncOptions
): Promise<BootstrapResult> {
  const {
    databaseName = 'main',
    apiUrl,
    pushIntervalMs = 2000,
    parentContainer,
  } = options;

  assertPatchDbSyncServerBaseUrl(apiUrl);

  const key = `${databaseName}:${apiUrl}`;
  if (Platform.OS === 'web' && cachedBootstrap?.key === key) {
    return cachedBootstrap.promise;
  }

  const bootstrapPromise = (async (): Promise<BootstrapResult> => {
    const sqlClient = await SqlClientImplExpoSqlite.open(databaseName);
    currentSqlClient = sqlClient;
    await sqlClient.connect();

    const localDb = new PatchDbImplSqlite(sqlClient);
    await localDb.migrate();

    const transport = new PatchDbClientTransportHttpFetch(apiUrl);
    const remoteDb = new PatchDbImplClientTransport(transport);
    const pubSub = new InMemoryPubSub();
    const syncDb = new SyncPatchesDb(localDb, remoteDb, pubSub, {
      pushIntervalMs,
      remoteInvalidationSource: transport,
    });

    const container = new DependencyInjectionContainer(parentContainer);
    container.registerValue(PatchesDbToken, syncDb);
    container.registerValue(SubscribablePatchesDbToken, syncDb);

    return { container };
  })();

  if (Platform.OS === 'web') {
    cachedBootstrap = { key, promise: bootstrapPromise };
  }
  return bootstrapPromise;
}

export async function clearLocalDatabaseAndReload(
  databaseName = 'main'
): Promise<void> {
  cachedBootstrap = null;
  if (currentSqlClient) {
    await currentSqlClient.disconnect();
    currentSqlClient = null;
  }
  await SQLite.deleteDatabaseAsync(databaseName);
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.reload();
  }
}
