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

/**
 * Web uses an in-memory sql.js DB per tab (server is the source of truth; patch-db
 * sync rebuilds the local cache). Native uses persistent expo-sqlite as before.
 *
 * We cannot share expo-sqlite across browser tabs: its `AccessHandlePoolVFS` grabs
 * an exclusive `FileSystemSyncAccessHandle` on every file in the shared OPFS pool
 * directory at worker init, so a second tab always fails with
 * `NoModificationAllowedError`. An in-memory per-tab DB sidesteps the whole VFS.
 */
let cachedBootstrap: { key: string; promise: Promise<BootstrapResult> } | null =
  null;
let currentSqlClient: SqlClient | null = null;

const SQL_JS_VERSION = '1.14.1';

async function openLocalSqlClient(databaseName: string): Promise<SqlClient> {
  if (Platform.OS === 'web') {
    // Dynamic import so `sql.js` (and its WebAssembly entrypoint) is never pulled
    // into the native Metro bundle.
    const { SqlClientImplSqlJs } = await import(
      '@gamezilla/shared/sql-client/impl-sql-js'
    );
    // Pinned CDN URL so Metro doesn't need to bundle / serve the wasm binary.
    // `Cross-Origin-Embedder-Policy: credentialless` (see app.json) permits
    // fetching cross-origin wasm without credentials.
    return await SqlClientImplSqlJs.openMemory({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/sql.js@${SQL_JS_VERSION}/dist/${file}`,
    });
  }
  return await SqlClientImplExpoSqlite.open(databaseName);
}

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
    const sqlClient = await openLocalSqlClient(databaseName);
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
    void bootstrapPromise.catch(() => {
      if (cachedBootstrap?.key === key) {
        cachedBootstrap = null;
      }
    });
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
  if (Platform.OS === 'web') {
    // Local DB is in-memory per tab; closing + reloading is enough.
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
    return;
  }
  await SQLite.deleteDatabaseAsync(databaseName);
}
