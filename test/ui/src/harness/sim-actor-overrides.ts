/**
 * Per-actor client composition seams for a product simulation session.
 *
 * Each actor gets its own in-memory secure storage, an isolated sync-engine
 * pool (no process-global key), and a Node `:memory:` SQLite opener so no
 * two actors share client state. The actor `Io` reuses the shared simulation
 * clock / timers / ids / rng but swaps in the in-process Hono HTTP client.
 */

import type { AppOverrides } from '@apps/client/providers/app-overrides';
import type { OpenLocalSqlClient } from '@apps/client/sync/create-local-sync-engine';
import {
  type AppSyncEnginePool,
  createAppSyncEnginePool,
} from '@apps/client/sync/sync-engine-pool';
import { createInMemoryAuthClientStorage } from '@pkgs/auth-better-auth/client';
import { wallClock, wallTimers } from '@pkgs/clock';
import type { HttpClient } from '@pkgs/http-client';
import type { Io, SimIo } from '@pkgs/io';
import { createInMemorySecureStorage } from '@pkgs/secure-storage/impl-memory';
import {
  createSecureStorageStore,
  type SecureStorageStore,
} from '@pkgs/secure-storage/secure-storage-store';
import { SqlClientImplNodeSqlite } from '@pkgs/sql-client/sqlite/impl-node-sqlite';

/** Builds an actor `Io` sharing sim nondeterminism but with in-process HTTP. */
export function createActorIo(base: SimIo, http: HttpClient): Io {
  return {
    // Wall clock/timers: product UI async (BA session, AuthBridge, sync) must
    // progress without the scenario pumping SimClock.advance.
    clock: {
      now: () => wallClock.now(),
    },
    timers: wallTimers,
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

/** Fresh, isolated client seams for one actor session. */
export function createActorClientSeams(apiUrl: string): ActorClientSeams {
  const openMemorySqlClient: OpenLocalSqlClient = async () => {
    const client = SqlClientImplNodeSqlite.open(':memory:');
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
    },
  };
}
