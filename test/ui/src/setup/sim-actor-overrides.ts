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
import BetterSqlite3 from 'better-sqlite3';

/**
 * Jest-immune wall timers for sim API + actor Io.
 * `wallTimers` / `globalThis.setTimeout` get faked after expo-router render;
 * product async must keep progressing on real Node timers.
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

/** Builds an actor `Io` sharing sim nondeterminism but with in-process HTTP. */
export function createActorIo(
  base: SimIo,
  http: HttpClient,
  getClockSkewMs: () => number = () => 0
): Io {
  return {
    clock: {
      now: () => wallClock.now() + getClockSkewMs(),
    },
    timers: simNodeTimers,
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
  /** Live better-sqlite3 handle once the client opens local SQLite. */
  readonly getSqlite: () => BetterSqlite3.Database | undefined;
  /** Close and drop the retained actor SQLite handle (if any). */
  readonly disposeSqlite: () => void;
};

export type CreateActorClientSeamsArgs = {
  readonly apiUrl: string;
  readonly pubSubBus: InMemoryBus;
  readonly nodeId?: string;
  /** Called when the actor's `:memory:` SQLite is opened (or closed). */
  readonly onSqlite?: (sqlite: BetterSqlite3.Database | undefined) => void;
};

/** Fresh, isolated client seams for one actor session. */
export function createActorClientSeams(
  args: CreateActorClientSeamsArgs
): ActorClientSeams {
  const { apiUrl, pubSubBus, onSqlite, nodeId } = args;
  let actorSqlite: BetterSqlite3.Database | undefined;
  const openMemorySqlClient: OpenLocalSqlClient = async () => {
    const sqlite = new BetterSqlite3(':memory:');
    actorSqlite = sqlite;
    onSqlite?.(sqlite);
    const client = new SqlClientImplBetterSqlite(sqlite);
    await client.connect();
    return client;
  };
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
      if (actorSqlite === undefined) return;
      try {
        actorSqlite.close();
      } catch {
        // Already closed during sync-engine teardown.
      }
      actorSqlite = undefined;
      onSqlite?.(undefined);
    },
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
