/**
 * Per-actor client composition seams for a product simulation session.
 */

import {
  clearInterval as nodeClearInterval,
  clearTimeout as nodeClearTimeout,
  setInterval as nodeSetInterval,
  setTimeout as nodeSetTimeout,
} from 'node:timers';
import { createInMemoryDevMenuPort } from '@apps/client/device/in-memory-dev-menu-port';
import { createInMemoryNetworkStatePort } from '@apps/client/device/in-memory-network-state-port';
import type { ClientSystemResources } from '@apps/client/providers/client-system-resources';
import type { OpenLocalSqlClient } from '@apps/client/sync/create-local-sync-engine';
import {
  type AppSyncEnginePool,
  createAppSyncEnginePool,
} from '@apps/client/sync/sync-engine-pool';
import { createInMemoryAuthClientStorage } from '@pkgs/auth-better-auth/client';
import type { Timers } from '@pkgs/clock';
import { KvImplInMemory } from '@pkgs/kv/impl-in-memory';
import type { InMemoryBus } from '@pkgs/pubsub/testing/in-memory';
import { createInMemoryPubSub } from '@pkgs/pubsub/testing/in-memory';
import { createInMemorySecureStorage } from '@pkgs/secure-storage/impl-memory';
import {
  createSecureStorageStore,
  type SecureStorageStore,
} from '@pkgs/secure-storage/secure-storage-store';
import { createInMemoryAudioPlaybackPort } from '@pkgs/sounds/audio-playback/in-memory-audio-playback-port';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBetterSqlite } from '@pkgs/sql-client/sqlite/impl-better-sqlite3';
import BetterSqlite3 from 'better-sqlite3';

/**
 * Jest-immune wall timers for sim API + actor Io.
 */
export const simNodeTimers: Timers = {
  setTimeout: (fn, ms) => nodeSetTimeout(fn, ms),
  clearTimeout: (handle) => {
    nodeClearTimeout(handle as ReturnType<typeof nodeSetTimeout>);
  },
  setInterval: (fn, ms) => nodeSetInterval(fn, ms),
  clearInterval: (handle) => {
    nodeClearInterval(handle as ReturnType<typeof nodeSetInterval>);
  },
};

export type ActorClientSeams = {
  readonly resources: ClientSystemResources;
  readonly secureStorageStore: SecureStorageStore;
  readonly syncEnginePool: AppSyncEnginePool;
  readonly getSqlite: () => BetterSqlite3.Database | undefined;
  readonly disposeSqlite: () => void;
};

export type CreateActorClientSeamsArgs = {
  readonly apiUrl: string;
  readonly pubSubBus: InMemoryBus;
  readonly nodeId?: string;
  readonly onSqlite?: (sqlite: BetterSqlite3.Database | undefined) => void;
  /**
   * Override local SQLite open (Expo web playground). Default is
   * better-sqlite3 `:memory:` for Jest.
   */
  readonly openSqlClient?: OpenLocalSqlClient;
};

/** Fresh, isolated client seams for one actor session. */
export function createActorClientSeams(
  args: CreateActorClientSeamsArgs
): ActorClientSeams {
  const { apiUrl, pubSubBus, onSqlite, nodeId, openSqlClient } = args;
  let actorSqlite: BetterSqlite3.Database | undefined;
  let actorClient: SqlClient | undefined;
  const defaultOpenMemorySqlClient: OpenLocalSqlClient = async () => {
    const sqlite = new BetterSqlite3(':memory:');
    actorSqlite = sqlite;
    onSqlite?.(sqlite);
    const client = new SqlClientImplBetterSqlite(sqlite);
    await client.connect();
    actorClient = client;
    return client;
  };
  const openLocal: OpenLocalSqlClient =
    openSqlClient !== undefined
      ? async (openArgs) => {
          const client = await openSqlClient(openArgs);
          actorClient = client;
          return client;
        }
      : defaultOpenMemorySqlClient;
  const secureStorageStore = createSecureStorageStore(
    createInMemorySecureStorage()
  );
  secureStorageStore.setValue('signInPending', null);
  const authClientStorage = createInMemoryAuthClientStorage();
  const syncEnginePool = createAppSyncEnginePool();
  const kv = new KvImplInMemory();
  const network = createInMemoryNetworkStatePort();
  const devMenu = createInMemoryDevMenuPort();
  const audio = createInMemoryAudioPlaybackPort();
  void nodeId;
  return {
    secureStorageStore,
    syncEnginePool,
    getSqlite: () => actorSqlite,
    disposeSqlite: () => {
      if (actorSqlite !== undefined) {
        try {
          actorSqlite.close();
        } catch {
          // Already closed during sync-engine teardown.
        }
        actorSqlite = undefined;
        onSqlite?.(undefined);
      }
      if (actorClient !== undefined) {
        void actorClient.disconnect();
        actorClient = undefined;
      }
    },
    resources: {
      apiUrl,
      authBaseURL: apiUrl,
      authClientStorage,
      secureStorageStore,
      syncEnginePool,
      openSqlClient: openLocal,
      createPubSub: () => createInMemoryPubSub({ bus: pubSubBus }),
      kv,
      network,
      devMenu,
      audio,
    },
  };
}
