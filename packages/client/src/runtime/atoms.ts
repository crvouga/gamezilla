import { createApiClient } from '@gamezilla/client/api/hc';
import { createPatchDbHcTransport } from '@gamezilla/client/api/patch-db-hc-transport';
import { createSecureStorage } from '@gamezilla/auth/client/create-secure-storage';
import { createDeviceService } from '@gamezilla/auth/client/device-service';
import { ensureDeviceEntity } from '@gamezilla/auth/client/ensure-device-entity';
import { ensureProfile } from '@gamezilla/profile/client/ensure-profile-entity';
import { createSessionService } from '@gamezilla/auth/client/session-service';
import { readSessionToken } from '@gamezilla/auth/client/session-token-storage';
import { readLastLocalAccountId } from '@gamezilla/auth/client/account-local-state';
import { createKeyValueStorage } from '@gamezilla/client/runtime/create-key-value-storage';
import {
  ACCOUNT_SESSION_ENTITY_TYPE,
  assertDeviceId,
} from '@gamezilla/auth/shared';
import { createConfigService } from '@gamezilla/client/config/config-service';
import type { KeyValueStorage } from '@gamezilla/lib/key-value-storage/interface';
import { createLogger } from '@gamezilla/lib/logger/logger';
import { InMemoryPubSub } from '@gamezilla/lib/pub-sub/impl-in-memory';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { PatchDbImplClientTransport } from '@gamezilla/patch-db/impl-client-transport';
import { PatchDbImplSqlite } from '@gamezilla/patch-db/impl-sqlite/impl-sqlite';
import { PATCHES_DB_TOPIC, SyncPatchDb } from '@gamezilla/patch-db/impl-sync';
import { PatchMetadataStamper } from '@gamezilla/patch-db/metadata/patch-metadata-stamper';
import {
  forceDetachPatchDbEntitySubscriptionsForDb,
  forceDetachPatchDbQuerySubscriptionsForDb,
  type PatchDbStackValue,
} from '@gamezilla/patch-db/react';
import type { SubscribablePatchDbLike } from '@gamezilla/patch-db/subscribable';
import { hydrateInMemoryStoreFromSqlite } from '@gamezilla/patch-db/react/hydrate-in-memory-store';
import { InMemoryEntityStore } from '@gamezilla/patch-db/react/in-memory-entity-store';
import { setInMemoryStoreForDb } from '@gamezilla/patch-db/react/in-memory-store-registry';
import { PatchDbWriteThroughMirror } from '@gamezilla/patch-db/react/write-through-mirror';
import { atom, getDefaultStore } from 'jotai';
import { atomEffect } from 'jotai-effect';
import { openSqlClientForPlatform } from './open-sql-client';

/**
 * expo-sqlite **web** multiplexes every DB into one shared {@link Worker}. If
 * `openDatabaseAsync` / `closeAsync` / `deleteDatabaseAsync` overlap across
 * connection swaps, the worker can process messages out of order and surface
 * a worker-level rejection at `WorkerChannel.ts:64` (`new Error(error)`).
 *
 * Serialize every connection-lifecycle worker call — **open** (from this
 * atom), **disconnect** (abort), and direct **delete** (sign-in/sign-out
 * cleanup) — on one tail so they never interleave on the shared worker.
 */
let sqlClientLifecycleTail: Promise<unknown> = Promise.resolve();

/** Queue connection-lifecycle work (open/close/delete) on the shared tail. */
export function enqueueSqlClientLifecycle<T>(fn: () => Promise<T>): Promise<T> {
  const job = sqlClientLifecycleTail.then(fn, fn) as Promise<T>;
  sqlClientLifecycleTail = job.then(
    () => undefined,
    () => undefined
  );
  return job;
}

/** Await all opens/disconnects/deletes already enqueued on {@link sqlClientAtom}. */
export async function awaitSqlClientDisconnectChain(): Promise<void> {
  await sqlClientLifecycleTail;
}

type PatchStackCleanupEntry = {
  id: string;
  cleanup: (reason: 'replaced' | 'abort') => void;
};

let activePatchStackCleanup: PatchStackCleanupEntry | null = null;

/**
 * Mirrors {@link activePatchStackCleanup} for {@link sqlClientAtom}. Jotai's
 * async-atom `signal` abort does not fire reliably on re-derivation in our
 * runtime, so when `accountId` changes the OLD client must be torn down via
 * this synchronous "register-and-replace" path instead of waiting for the
 * signal.
 *
 * **Account-keyed**: only replace when the new derivation targets a different
 * `accountId`. React 18 StrictMode and atom subscription churn can re-run
 * `sqlClientAtom` for the *same* `accountId`; tearing down the existing
 * client in that case rejects every in-flight `client.run/query` from the
 * still-running consumer derivations (logs showed `client disconnecting or
 * already closed` cascades from `entityBootstrapEffect`, `ensureDeviceEntity`,
 * `ensureProfile`, `SyncPatchDb.write`).
 */
type SqlClientCleanupEntry = {
  id: string;
  accountKey: string;
  client: SqlClient;
  disconnect: () => Promise<unknown>;
};

let activeSqlClientCleanup: SqlClientCleanupEntry | null = null;

async function disconnectActiveSqlClientIfAny(): Promise<void> {
  const prev = activeSqlClientCleanup;
  if (prev === null) return;
  activeSqlClientCleanup = null;
  await prev.disconnect().catch(() => undefined);
}

function registerPatchStackCleanup(args: {
  decorated: SubscribablePatchDbLike;
  sync: SyncPatchDb;
  signal: AbortSignal;
}): void {
  const { decorated, sync, signal } = args;
  const stackId = `stack-${String(Date.now())}-${Math.random().toString(36).slice(2, 8)}`;
  let cleaned = false;
  const cleanup = (_reason: 'replaced' | 'abort') => {
    if (cleaned) return;
    cleaned = true;
    forceDetachPatchDbQuerySubscriptionsForDb(decorated);
    forceDetachPatchDbEntitySubscriptionsForDb(decorated);
    sync.destroy();
    if (activePatchStackCleanup?.id === stackId) {
      activePatchStackCleanup = null;
    }
  };
  if (activePatchStackCleanup !== null) {
    activePatchStackCleanup.cleanup('replaced');
  }
  activePatchStackCleanup = { id: stackId, cleanup };
  signal.addEventListener('abort', () => cleanup('abort'));
}

/** Last signed-in account for native cold start (SQLite file selection). */
export const accountIdAtom = atom<string | null>(null);

/** Bearer token for patch-db transport; read per-request via {@link getDefaultStore}. */
export const sessionTokenAtom = atom<string | null>(null);

export const configServiceAtom = atom(createConfigService());

export const loggerAtom = atom(createLogger({ name: 'client' }));

export const secureStorageAtom = atom<SecureStorage>(createSecureStorage());

/**
 * Bulk async key-value storage (localStorage on web, AsyncStorage on native).
 * Use for cache/queue blobs that may exceed the 2048-byte expo-secure-store
 * cap (e.g. `KeyValueClientRoomStorage`-style room state). Not encrypted.
 */
export const keyValueStorageAtom = atom<KeyValueStorage>(
  createKeyValueStorage()
);

export const deviceServiceAtom = atom(async (get) => {
  const storage = get(secureStorageAtom);
  return await createDeviceService(storage);
});

/**
 * Per-account or anonymous-by-device-id file DB via expo-sqlite. Same code
 * path on native and web (web uses expo-sqlite's OPFS adapter). See
 * {@link openSqlClientForPlatform} and `account-db.ts`.
 */
export const sqlClientAtom = atom(async (get, { signal }) => {
  const deviceService = await get(deviceServiceAtom);
  const storage = get(secureStorageAtom);
  const fromAtom = get(accountIdAtom);
  const fromDisk =
    fromAtom === null ? await readLastLocalAccountId(storage) : null;
  if (fromAtom === null && fromDisk !== null) {
    getDefaultStore().set(accountIdAtom, fromDisk);
  }
  const forOpen = getDefaultStore().get(accountIdAtom) ?? fromDisk;
  const accountKey = forOpen ?? '<anon>';

  /**
   * Always close the previous handle on the shared expo-sqlite web worker
   * before opening again when the **account file** changes. When the key is
   * unchanged (e.g. `hydrateAccountIdEffect` racing this atom), reuse the live
   * client so we do not disconnect/reopen the same file repeatedly.
   */
  const sql = await enqueueSqlClientLifecycle(async () => {
    if (
      activeSqlClientCleanup !== null &&
      activeSqlClientCleanup.accountKey === accountKey
    ) {
      return activeSqlClientCleanup.client;
    }
    await disconnectActiveSqlClientIfAny();
    const opened = await openSqlClientForPlatform({
      getAccountId: () => getDefaultStore().get(accountIdAtom) ?? forOpen,
      getDeviceId: () => deviceService.getDeviceId(),
    });
    // Register before returning so the next queued lifecycle job sees reuse
    // (avoids a duplicate open in the window before this async atom resumes).
    const id = `sql-${String(Date.now())}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    activeSqlClientCleanup = {
      id,
      accountKey,
      client: opened,
      disconnect: () => opened.disconnect(),
    };
    return opened;
  });

  const entry = activeSqlClientCleanup;
  if (entry === null || entry.client !== sql) {
    throw new Error('sqlClientAtom: lifecycle invariant failed');
  }

  signal.addEventListener('abort', () => {
    if (activeSqlClientCleanup !== entry) {
      return;
    }
    activeSqlClientCleanup = null;
    void enqueueSqlClientLifecycle(() =>
      entry.client.disconnect().catch(() => {})
    );
  });
  return sql;
});

async function createPatchDbStack(args: {
  sql: SqlClient;
  config: ReturnType<typeof createConfigService>;
  deviceService: Awaited<ReturnType<typeof createDeviceService>>;
  storage: SecureStorage;
  signal: AbortSignal;
}): Promise<PatchDbStackValue> {
  const { sql, config, deviceService, storage, signal } = args;

  const persistedToken = await readSessionToken(storage);
  if (persistedToken !== null) {
    getDefaultStore().set(sessionTokenAtom, persistedToken);
  }

  const local = new PatchDbImplSqlite(sql);
  await local.migrate();

  const installId = deviceService.getDeviceId();
  assertDeviceId(installId);

  const transport = createPatchDbHcTransport(
    createApiClient(config.getApiUrl()),
    {
      patchDbBaseUrl: `${config.getApiUrl()}/patch-db`,
      getAuthToken: () => getDefaultStore().get(sessionTokenAtom),
      getAnonId: () => installId,
    }
  );

  const remote = new PatchDbImplClientTransport(transport);
  const pubSub = new InMemoryPubSub();
  const sync = new SyncPatchDb(local, remote, pubSub, {
    pushIntervalMs: 2000,
    pollIntervalMs: 5000,
  });

  const stamper = new PatchMetadataStamper(sync, {
    getDeviceId: () => installId,
    getMyId: () => {
      const aid = getDefaultStore().get(accountIdAtom);
      return aid !== null && aid.length > 0 ? aid : installId;
    },
    assertDeviceId: (id) => assertDeviceId(id),
  });

  const store = new InMemoryEntityStore();
  await hydrateInMemoryStoreFromSqlite(local, store);

  const decorated = new PatchDbWriteThroughMirror(stamper, store);
  setInMemoryStoreForDb(decorated, store);

  const pollMirrorUnsub = pubSub.subscribe(PATCHES_DB_TOPIC, () => {
    void hydrateInMemoryStoreFromSqlite(local, store);
  });

  registerPatchStackCleanup({ decorated, sync, signal });
  signal.addEventListener('abort', () => pollMirrorUnsub());

  await stamper.clearRejectedPushes();

  await sync.markAllUnsyncedPatchesForEntityTypeAsAlreadyOnRemote(
    ACCOUNT_SESSION_ENTITY_TYPE
  );

  return {
    db: decorated,
    sync,
    pubSub,
    decorated,
  };
}

export const patchDbStackAtom = atom(async (get, { signal }) => {
  const sql = await get(sqlClientAtom);
  const config = get(configServiceAtom);
  const deviceService = await get(deviceServiceAtom);
  const storage = get(secureStorageAtom);
  return await createPatchDbStack({
    sql,
    config,
    deviceService,
    storage,
    signal,
  });
});

export const sessionServiceAtom = atom(async (get) => {
  const stack = await get(patchDbStackAtom);
  const deviceService = await get(deviceServiceAtom);
  return createSessionService(stack.db, deviceService);
});

/**
 * Device row + profile for current {@link myId} (`accountId` when signed in,
 * else install id).
 */
export const entityBootstrapEffect = atomEffect((get) => {
  let cancelled = false;
  void (async () => {
    try {
      const deviceService = await get(deviceServiceAtom);
      const stack = await get(patchDbStackAtom);
      const accountId = get(accountIdAtom);
      if (cancelled) return;
      const installId = deviceService.getDeviceId();
      await ensureDeviceEntity(stack.db, installId);
      if (cancelled) return;
      const myId =
        accountId !== null && accountId.length > 0 ? accountId : installId;
      await ensureProfile(stack.db, myId);
    } catch {
      // Stale derivations see `client disconnecting or already closed` when
      // `sqlClientAtom` is replaced mid-flight (sign-in/sign-out). The next
      // effect run on the new stack will write the rows; swallow here so the
      // doomed run does not surface as an unhandled rejection.
    }
  })();
  return () => {
    cancelled = true;
  };
});
