// @io-wall-ok — composition root: wall Io + Expo SQLite for playground actors.
/**
 * Boot two isolated product actor sessions against the live API
 * (no in-process World — that stays in @test/ui DST).
 */

import { createInMemoryDevMenuPort } from '@apps/client/device/in-memory-dev-menu-port';
import { createInMemoryNetworkStatePort } from '@apps/client/device/in-memory-network-state-port';
import type { ClientSystemResources } from '@apps/client/providers/client-system-resources';
import { createAppSyncEnginePool } from '@apps/client/sync/sync-engine-pool';
import { createInMemoryAuthClientStorage } from '@pkgs/auth-better-auth/client';
import { wallTimers } from '@pkgs/clock';
import type { Io } from '@pkgs/io';
import { wallIo } from '@pkgs/io';
import { KvImplInMemory } from '@pkgs/kv/impl-in-memory';
import {
  createInMemoryBus,
  createInMemoryPubSub,
  type InMemoryBus,
} from '@pkgs/pubsub/testing/in-memory';
import { createInMemorySecureStorage } from '@pkgs/secure-storage/impl-memory';
import { createSecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';
import { createInMemoryAudioPlaybackPort } from '@pkgs/sounds/audio-playback/in-memory-audio-playback-port';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplExpoSqlite } from '@pkgs/sql-client/sqlite/impl-expo-sqlite';
import type { PlaygroundSession } from '@pkgs/system-console/client';

import { getApiBaseUrl } from '../config/api-servers';

async function openActorSql(name: string): Promise<SqlClientImplExpoSqlite> {
  return SqlClientImplExpoSqlite.open(name, wallTimers);
}

function makeActorIo(apiUrl: string): Io {
  const base = wallIo();
  return {
    ...base,
    http: {
      fetch: (input, init) => {
        if (typeof input === 'string' && input.startsWith('/')) {
          return base.http.fetch(`${apiUrl}${input}`, init);
        }
        return base.http.fetch(input, init);
      },
    },
  };
}

function makeActorResources(args: {
  readonly apiUrl: string;
  readonly pubSubBus: InMemoryBus;
  readonly sqlClient: SqlClient;
}): ClientSystemResources {
  const secureStorageStore = createSecureStorageStore(
    createInMemorySecureStorage()
  );
  secureStorageStore.setValue('signInPending', null);
  const authClientStorage = createInMemoryAuthClientStorage();
  const syncEnginePool = createAppSyncEnginePool();
  return {
    apiUrl: args.apiUrl,
    authBaseURL: args.apiUrl,
    authClientStorage,
    secureStorageStore,
    syncEnginePool,
    openSqlClient: async () => args.sqlClient,
    createPubSub: () => createInMemoryPubSub({ bus: args.pubSubBus }),
    kv: new KvImplInMemory(),
    network: createInMemoryNetworkStatePort(),
    devMenu: createInMemoryDevMenuPort(),
    audio: createInMemoryAudioPlaybackPort(),
  };
}

/**
 * Two Expo-SQLite-backed product actors sharing an in-memory pubsub bus,
 * talking to the configured live API.
 */
export async function bootPlaygroundSession(): Promise<
  PlaygroundSession<ClientSystemResources>
> {
  const apiUrl = getApiBaseUrl();
  const pubSubBus = createInMemoryBus();

  const aliceSql = await openActorSql('sim_alice');
  const bobSql = await openActorSql('sim_bob');

  return {
    actors: {
      alice: {
        id: 'alice',
        io: makeActorIo(apiUrl),
        resources: makeActorResources({
          apiUrl,
          pubSubBus,
          sqlClient: aliceSql,
        }),
      },
      bob: {
        id: 'bob',
        io: makeActorIo(apiUrl),
        resources: makeActorResources({
          apiUrl,
          pubSubBus,
          sqlClient: bobSql,
        }),
      },
    },
    async dispose() {
      await aliceSql.disconnect();
      await bobSql.disconnect();
    },
  };
}
