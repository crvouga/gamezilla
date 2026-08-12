/**
 * Per-actor client composition seams for a product simulation session.
 *
 * Each actor gets its own in-memory secure storage, an isolated sync-engine
 * pool (no process-global key), and a Node `:memory:` SQLite opener so no
 * two actors share client state. The actor `Io` reuses the shared simulation
 * clock / timers / ids / rng but swaps in the in-process Hono HTTP client.
 */

import {
  clearInterval as nodeClearInterval,
  clearTimeout as nodeClearTimeout,
  setInterval as nodeSetInterval,
  setTimeout as nodeSetTimeout,
} from 'node:timers';
import { createInMemoryDevMenuPort } from '@apps/client/device/in-memory-dev-menu-port';
import { createInMemoryNetworkStatePort } from '@apps/client/device/in-memory-network-state-port';
import type { AppOverrides } from '@apps/client/providers/app-overrides';
import type { OpenLocalSqlClient } from '@apps/client/sync/create-local-sync-engine';
import {
  type AppSyncEnginePool,
  createAppSyncEnginePool,
} from '@apps/client/sync/sync-engine-pool';
import { createInMemoryAuthClientStorage } from '@pkgs/auth-better-auth/client';
import type { Timers } from '@pkgs/clock';
import { wallClock } from '@pkgs/clock';
import type { HttpClient } from '@pkgs/http-client';
import type { Io, SimIo } from '@pkgs/io';
import { KvImplInMemory } from '@pkgs/kv/impl-in-memory';
import type { InMemoryBus } from '@pkgs/pubsub/testing/in-memory';
import { createInMemoryPubSub } from '@pkgs/pubsub/testing/in-memory';
import { createInMemorySecureStorage } from '@pkgs/secure-storage/impl-memory';
import {
  createSecureStorageStore,
  type SecureStorageStore,
} from '@pkgs/secure-storage/secure-storage-store';
import { createInMemoryAudioPlaybackPort } from '@pkgs/sounds/audio-playback/in-memory-audio-playback-port';
import { SqlClientImplBetterSqlite } from '@pkgs/sql-client/sqlite/impl-better-sqlite3';

/** Jest-immune timers (see create-client-simulation-system `simNodeTimers`). */
const actorNodeTimers: Timers = {
  setTimeout: (fn, ms) => nodeSetTimeout(fn, ms),
  clearTimeout: (handle) => {
    nodeClearTimeout(handle as ReturnType<typeof nodeSetTimeout>);
  },
  setInterval: (fn, ms) => nodeSetInterval(fn, ms),
  clearInterval: (handle) => {
    nodeClearInterval(handle as ReturnType<typeof nodeSetInterval>);
  },
};

/** Builds an actor `Io` sharing sim nondeterminism but with in-process HTTP. */
export function createActorIo(base: SimIo, http: HttpClient): Io {
  return {
    // Wall clock + Node timers: product UI async must progress without
    // SimClock.advance and must ignore Jest fake timers from expo-router/RNTL.
    clock: {
      now: () => wallClock.now(),
    },
    timers: actorNodeTimers,
    createId: base.createId,
    random: base.random,
    http,
    seed: base.seed,
  };
}

export type ActorClientSeams = {
  readonly overrides: AppOverrides;
  readonly secureStorageStore: SecureStorageStore;
  readonly syncEnginePool: AppSyncEnginePool;
};

export type CreateActorClientSeamsArgs = {
  readonly apiUrl: string;
  readonly pubSubBus: InMemoryBus;
};

/** Fresh, isolated client seams for one actor session. */
export function createActorClientSeams(
  args: CreateActorClientSeamsArgs
): ActorClientSeams {
  const { apiUrl, pubSubBus } = args;
  const openMemorySqlClient: OpenLocalSqlClient = async () => {
    const client = SqlClientImplBetterSqlite.open(':memory:');
    await client.connect();
    return client;
  };
  const secureStorageStore = createSecureStorageStore(
    createInMemorySecureStorage()
  );
  // Fresh installs must not resume a phantom OAuth pending marker.
  secureStorageStore.setValue('signInPending', null);
  const authClientStorage = createInMemoryAuthClientStorage();
  const syncEnginePool = createAppSyncEnginePool();
  const kv = new KvImplInMemory();
  const network = createInMemoryNetworkStatePort();
  const devMenu = createInMemoryDevMenuPort();
  const audio = createInMemoryAudioPlaybackPort();
  return {
    secureStorageStore,
    syncEnginePool,
    overrides: {
      apiUrl,
      authBaseURL: apiUrl,
      authClientStorage,
      secureStorageStore,
      syncEnginePool,
      openSqlClient: openMemorySqlClient,
      createPubSub: () => createInMemoryPubSub({ bus: pubSubBus }),
      kv,
      network,
      devMenu,
      audio,
    },
  };
}
