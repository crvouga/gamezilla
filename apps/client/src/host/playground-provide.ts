/**
 * Browser playground provide map for `@pkgs/system` createWorld.
 * Mirrors `@test/ui` product-provide but uses OPFS / expo-sqlite + web namespaces.
 */

import type { OpenRequestDb } from '@apps/api/db/open-request-db';
import { attachSimOpenRequestDb } from '@apps/api/system/sim-open-request-db';
import { createInMemoryStripe } from '@libs/stripe/in-memory-stripe';
import type { Timers } from '@pkgs/clock';
import { KvImplInMemory } from '@pkgs/kv/impl-in-memory';
import {
  clearNamespacedKvWeb,
  KvImplWebNamespaced,
} from '@pkgs/kv/impl-kv-web-namespaced';
import type { Kv } from '@pkgs/kv/interface';
import { InMemoryLlmProvider } from '@pkgs/llm/server';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { createNoopObservability } from '@pkgs/observability/impl-noop/impl-noop';
import type { PubSub } from '@pkgs/pubsub/interface';
import {
  createInMemoryPubSub,
  type InMemoryBus,
} from '@pkgs/pubsub/testing/in-memory';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplExpoSqlite } from '@pkgs/sql-client/sqlite/impl-expo-sqlite';
import {
  coerceSqliteDbBytes,
  isNotADatabaseError,
} from '@pkgs/sql-client/sqlite/sqlite-db-bytes';
import {
  createExpoWebSqlClient,
  type ExpoWebSqlClient,
} from '@pkgs/sql-client/sqlite/web';
import { decoratePort, type ProviderSpec, stubPort } from '@pkgs/system';
import { InMemoryTtsProvider } from '@pkgs/tts/server';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

export type PlaygroundSqlHandle = {
  readonly sqlClient: SqlClient;
  readonly databaseName: string;
  disconnect(): Promise<void>;
  reset(): Promise<void>;
  exportBytes(): Promise<Uint8Array>;
  importBytes(bytes: Uint8Array): Promise<void>;
};

export async function openPlaygroundSql(
  databaseName: string,
  timers: Timers
): Promise<PlaygroundSqlHandle> {
  if (Platform.OS === 'web') {
    const client: ExpoWebSqlClient = createExpoWebSqlClient(databaseName, {
      timers,
    });
    try {
      await client.connect();
    } catch (error: unknown) {
      // Owner open already delete-retries; persistent NOTADB needs OPFS wipe.
      if (isNotADatabaseError(error)) {
        const { runWebOpfsRecoveryAndReload } = await import(
          '@pkgs/sql-client/sqlite/web/opfs-recover'
        );
        const returnTo =
          typeof window !== 'undefined'
            ? `${window.location.pathname}${window.location.search}${window.location.hash}`
            : undefined;
        await runWebOpfsRecoveryAndReload({
          timers,
          closeLocal: () => client.disconnect(),
          ...(returnTo !== undefined && returnTo.length > 0
            ? { returnTo }
            : {}),
        });
      }
      throw error;
    }
    return {
      sqlClient: client,
      databaseName,
      disconnect: () => client.disconnect(),
      reset: () => client.resetDatabase(),
      exportBytes: () => client.exportBytes(),
      importBytes: (bytes) => client.importBytes(bytes),
    };
  }
  const client = await SqlClientImplExpoSqlite.open(databaseName, timers);
  await client.connect();
  let live: SqlClientImplExpoSqlite = client;
  const handle: PlaygroundSqlHandle = {
    get sqlClient() {
      return live;
    },
    databaseName,
    disconnect: () => live.disconnect(),
    reset: async () => {
      await live.disconnect();
      await SQLite.deleteDatabaseAsync(databaseName);
    },
    exportBytes: async () =>
      coerceSqliteDbBytes(
        await live.getSqliteDatabase().serializeAsync('main')
      ),
    importBytes: async (bytes) => {
      const payload = coerceSqliteDbBytes(bytes);
      await live.disconnect();
      try {
        await SQLite.deleteDatabaseAsync(databaseName);
      } catch {
        // missing ok
      }
      const mem = await SQLite.deserializeDatabaseAsync(payload);
      const dest = await SQLite.openDatabaseAsync(databaseName);
      try {
        await SQLite.backupDatabaseAsync({
          sourceDatabase: mem,
          destDatabase: dest,
        });
      } finally {
        await mem.closeAsync();
        await dest.closeAsync();
      }
      live = await SqlClientImplExpoSqlite.open(databaseName, timers);
      await live.connect();
    },
  };
  return handle;
}

/** Ignore request-middleware disconnect on shared process-lifetime DBs. */
export function sharedRequestSqlClient(sqlClient: SqlClient): SqlClient {
  return {
    connect: async () => undefined,
    disconnect: async () => undefined,
    query: (query) => sqlClient.query(query),
    run: (query) => sqlClient.run(query),
    prepare: (query) => sqlClient.prepare(query),
    transaction: <T>(fn: (tx: SqlClient) => Promise<T>) =>
      sqlClient.transaction(fn),
  };
}

export function sessionOwnedSqlClient(sqlClient: SqlClient): SqlClient {
  return sharedRequestSqlClient(sqlClient);
}

export function clientDbName(instanceId: string): string {
  return `playground_client_${instanceId}`;
}

export function clientNamespace(instanceId: string): string {
  return `playground_client_${instanceId}`;
}

/** Parse `client:alice.db` / `client:alice.kv` → `alice`. */
export function clientInstanceIdFromLeafAddress(address: string): string {
  const match = /^client:([^.]+)\./.exec(address);
  if (match?.[1] !== undefined) return match[1];
  const colon = address.indexOf(':');
  if (colon >= 0) {
    const rest = address.slice(colon + 1);
    const dot = rest.indexOf('.');
    return dot >= 0 ? rest.slice(0, dot) : rest;
  }
  return address;
}

function kvProvider(namespace?: string): ProviderSpec<Kv> {
  return decoratePort<Kv>(
    () =>
      Platform.OS === 'web' && namespace !== undefined
        ? new KvImplWebNamespaced(namespace)
        : new KvImplInMemory(),
    {
      wipe(instance) {
        if (instance instanceof KvImplInMemory) instance.clearForTest();
        if (namespace !== undefined) clearNamespacedKvWeb(namespace);
      },
      corrupt(instance) {
        if (instance instanceof KvImplInMemory) {
          instance.armFault(new Error('kv corrupted'));
        }
      },
    }
  );
}

function blobProvider(): ProviderSpec<ObjectStore> {
  return decoratePort<ObjectStore>(() => new ObjectStoreImplInMemory(), {
    corrupt(instance) {
      if (instance instanceof ObjectStoreImplInMemory) {
        instance.armFault(new Error('blob corrupted'));
      }
    },
  });
}

export type PlaygroundProvideHandles = {
  readonly serverSql: PlaygroundSqlClientBundle;
  readonly pubSubBus: InMemoryBus;
  readonly timers: Timers;
  /** Tracks opened client DB handles for wipe/dispose. */
  readonly clientSqlByAddress: Map<string, PlaygroundSqlHandle>;
};

export type PlaygroundSqlClientBundle = {
  readonly sqlClient: SqlClient;
  readonly openRequestDb: OpenRequestDb;
  readonly handle: PlaygroundSqlHandle;
};

export function createPlaygroundProvide(
  handles: PlaygroundProvideHandles
): Record<string, ProviderSpec> {
  const dbProvider = decoratePort<SqlClient>(async () => {
    return attachSimOpenRequestDb(
      handles.serverSql.sqlClient,
      handles.serverSql.openRequestDb
    );
  });

  const eventsProvider = decoratePort<PubSub>(async () => {
    return createInMemoryPubSub({ bus: handles.pubSubBus });
  });

  const clientDbProvider = decoratePort<SqlClient>(
    async (address) => {
      const existing = handles.clientSqlByAddress.get(address);
      if (existing !== undefined)
        return sessionOwnedSqlClient(existing.sqlClient);
      const instanceId = clientInstanceIdFromLeafAddress(address);
      const handle = await openPlaygroundSql(
        clientDbName(instanceId),
        handles.timers
      );
      handles.clientSqlByAddress.set(address, handle);
      return sessionOwnedSqlClient(handle.sqlClient);
    },
    {
      async wipe(_instance, address) {
        const handle = handles.clientSqlByAddress.get(address);
        if (handle === undefined) return;
        await handle.reset();
        handles.clientSqlByAddress.delete(address);
      },
    }
  );

  return {
    db: dbProvider,
    events: eventsProvider,
    'api.kv': kvProvider(),
    'api.media': blobProvider(),
    'api.payments': stubPort(
      createInMemoryStripe({ baseUrl: 'http://sim.local' })
    ),
    'api.tts': stubPort(new InMemoryTtsProvider()),
    'api.llm': stubPort(new InMemoryLlmProvider()),
    'client.db': clientDbProvider,
    'client.kv': decoratePort<Kv>((address) => {
      const instanceId = clientInstanceIdFromLeafAddress(address);
      return Platform.OS === 'web'
        ? new KvImplWebNamespaced(clientNamespace(instanceId))
        : new KvImplInMemory();
    }),
    'client.observability': stubPort(
      createNoopObservability('playground-client')
    ),
    'room.storage': kvProvider(),
    'room:*.storage': kvProvider(),
  };
}
