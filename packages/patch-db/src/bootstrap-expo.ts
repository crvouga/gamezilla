import { DependencyInjectionContainer } from '@gamezilla/shared/dependency-injection/dependency-injection-container';
import { InMemoryPubSub } from '@gamezilla/shared/pub-sub/impl-in-memory';
import { SqlClientImplExpoSqlite } from '@gamezilla/shared/sql-client/impl-expo-sqlite';
import type { SqlClient } from '@gamezilla/shared/sql-client/interface';
import { assertDatabaseName } from '@gamezilla/shared/sqlite';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { assertUrl } from './assert-url';
import { PatchDbImplClientTransport } from './impl-client-transport';
import { PatchDbImplSqlite } from './impl-sqlite/impl-sqlite';
import { SyncPatchesDb } from './impl-sync';
import { PatchesDbToken } from './react';
import {
  SubscribablePatchesDbToken,
  type SubscribablePatchesDbLike,
} from './subscribable';
import type { PatchDbClientTransport } from './transport';
import { PatchDbClientTransportHttpFetch } from './transport';

export type BootstrapResult = {
  container: DependencyInjectionContainer;
};

export type BootstrapPatchDbExpoSyncOptions = {
  databaseName?: string;
  /** Absolute URL including patch-db base path, e.g. `https://host/patch-db`. */
  apiUrl: string;
  /** If set, used instead of {@link PatchDbClientTransportHttpFetch}(apiUrl). */
  transport?: PatchDbClientTransport;
  pushIntervalMs?: number;
  pollIntervalMs?: number;
  parentContainer?: DependencyInjectionContainer;
  /**
   * Wrap the sync DB (e.g. stamp every patch with principalId via `createdBy`).
   * Must preserve {@link SubscribablePatchesDbLike.subscribe}.
   */
  decoratePatchesDb?: (
    db: SubscribablePatchesDbLike
  ) => SubscribablePatchesDbLike;
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
    transport: transportOption,
    pushIntervalMs = 2000,
    pollIntervalMs = 5000,
    parentContainer,
    decoratePatchesDb,
  } = options;

  assertDatabaseName(databaseName);
  assertUrl(apiUrl);

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

    const transport =
      transportOption ?? new PatchDbClientTransportHttpFetch(apiUrl);
    const remoteDb = new PatchDbImplClientTransport(transport);
    const pubSub = new InMemoryPubSub();
    const syncDb = new SyncPatchesDb(localDb, remoteDb, pubSub, {
      pushIntervalMs,
      pollIntervalMs,
    });

    const dbForDi: SubscribablePatchesDbLike =
      decoratePatchesDb !== undefined ? decoratePatchesDb(syncDb) : syncDb;

    const container = new DependencyInjectionContainer(parentContainer);
    container.registerValue(PatchesDbToken, dbForDi);
    container.registerValue(SubscribablePatchesDbToken, dbForDi);

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
