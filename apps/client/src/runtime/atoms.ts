import { createApiClient } from '@gamezilla/client/api/hc';
import { createPatchDbHcTransport } from '@gamezilla/client/api/patch-db-hc-transport';
import { createSecureStorage } from '@gamezilla/client/auth/create-secure-storage';
import { createKeyValueStorage } from '@gamezilla/client/runtime/create-key-value-storage';
import { createDeviceService } from '@gamezilla/client/auth/device-service';
import { ensureDeviceEntity } from '@gamezilla/client/auth/ensure-device-entity';
import {
  ensureAccountProfile,
  ensureDeviceProfile,
} from '@gamezilla/client/auth/ensure-profile-entity';
import { createSessionService } from '@gamezilla/client/auth/session-service';
import { readSessionToken } from '@gamezilla/client/auth/session-token-storage';
import {
  ensureAccountDatabaseDirectory,
  openAccountDb,
  openAnonymousDb,
} from '@gamezilla/client/db/account-db';
import { ensureServerClientId } from '@gamezilla/client/db/ensure-server-client-id';
import {
  ACCOUNT_SESSION_ENTITY_TYPE,
  assertDeviceId,
} from '@gamezilla/domain/auth';
import { createConfigService } from '@gamezilla/domain/config/config-service';
import { createLogger } from '@gamezilla/lib/logger/logger';
import type { KeyValueStorage } from '@gamezilla/lib/key-value-storage/interface';
import { InMemoryPubSub } from '@gamezilla/lib/pub-sub/impl-in-memory';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';
import { SqlClientImplSqlJs } from '@gamezilla/lib/sql-client/impl-sql-js';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { PatchDbImplClientTransport } from '@gamezilla/patch-db/impl-client-transport';
import { PatchDbImplSqlite } from '@gamezilla/patch-db/impl-sqlite/impl-sqlite';
import { SyncPatchDb } from '@gamezilla/patch-db/impl-sync';
import { PatchMetadataStamper } from '@gamezilla/patch-db/metadata/patch-metadata-stamper';
import {
  forceDetachPatchDbQuerySubscriptionsForDb,
  type PatchDbStackValue,
} from '@gamezilla/patch-db/react';
import { atom, getDefaultStore } from 'jotai';
import { atomEffect } from 'jotai-effect';
import { Platform } from 'react-native';

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

export const accountDbDirectoryAtom = atom(async () => {
  return await ensureAccountDatabaseDirectory();
});

/**
 * Resolve sql.js's wasm against `window.location.origin` instead of
 * `document.baseURI` so SPA navigation (deep route reloads) still hits
 * `/sql-wasm-browser.wasm`. The wasm itself is copied into `apps/client/public`
 * by `scripts/bundle-sqljs-wasm.ts` (wired through the `pre*` hooks).
 */
function locateSqlJsWasmFile(file: string): string {
  if (typeof window === 'undefined') return file;
  return new URL(`/${file}`, window.location.origin).href;
}

/**
 * Web client uses an in-memory sql.js database — one per tab. Persisting to
 * OPFS via expo-sqlite tied every browser tab to a single shared
 * `AccessHandlePoolVFS`, so a second tab could not boot at all (the worker
 * threw on `createSyncAccessHandle`). The patch-db sync layer rehydrates from
 * the server on cold start, so losing the local cache on tab refresh is fine.
 */
async function openWebSqlMain(signal: AbortSignal): Promise<SqlClient> {
  const client = await SqlClientImplSqlJs.openMemory({
    locateFile: locateSqlJsWasmFile,
  });
  await client.connect();
  signal.addEventListener(
    'abort',
    () => {
      void client.disconnect();
    },
    { once: true }
  );
  return client;
}

export const sqlClientAtom = atom(async (get, { signal }) => {
  if (Platform.OS === 'web') {
    return openWebSqlMain(signal);
  }

  await get(accountDbDirectoryAtom);
  const accountId = get(accountIdAtom);
  const storage = get(secureStorageAtom);
  const configService = get(configServiceAtom);
  const apiUrl = configService.getApiUrl();

  const sql: SqlClient =
    accountId !== null
      ? await openAccountDb(accountId)
      : await openAnonymousDb(await ensureServerClientId(apiUrl, storage));

  signal.addEventListener('abort', () => {
    void sql.disconnect();
  });
  return sql;
});

export const patchDbStackAtom = atom(async (get, { signal }) => {
  const sql = await get(sqlClientAtom);
  const config = get(configServiceAtom);
  const deviceService = await get(deviceServiceAtom);
  const storage = get(secureStorageAtom);

  // Hydrate the Bearer **before** the first push/poll. Cold-start otherwise
  // races: the patch-db transport reads `sessionTokenAtom` per request, and
  // any push that fires before `auth-context` finishes its async refresh
  // would go out unauthenticated and bounce off ABAC. `auth-service` is the
  // sole *mutator* of this atom; this hydration is the only read-from-storage
  // path so the contract holds.
  const persistedToken = await readSessionToken(storage);
  if (persistedToken !== null) {
    getDefaultStore().set(sessionTokenAtom, persistedToken);
  }

  const local = new PatchDbImplSqlite(sql);
  await local.migrate();

  const transport = createPatchDbHcTransport(
    createApiClient(config.getApiUrl()),
    {
      patchDbBaseUrl: `${config.getApiUrl()}/patch-db`,
      /**
       * Read per-request via the store so token rotation (refresh flow keeps the
       * user logged in but issues a new access token) propagates without
       * rebuilding the patch-db stack. Do not capture into a closure.
       */
      getAuthToken: () => getDefaultStore().get(sessionTokenAtom),
    }
  );

  const remote = new PatchDbImplClientTransport(transport);
  const pubSub = new InMemoryPubSub();
  const sync = new SyncPatchDb(local, remote, pubSub, {
    pushIntervalMs: 2000,
    pollIntervalMs: 5000,
  });

  const stamper = new PatchMetadataStamper(sync, {
    getDeviceId: () => deviceService.getDeviceId(),
    getAccountId: () => getDefaultStore().get(accountIdAtom),
    assertDeviceId: (id) => assertDeviceId(id),
  });

  await stamper.backfillCreatedBy();

  signal.addEventListener('abort', () => {
    forceDetachPatchDbQuerySubscriptionsForDb(stamper);
    sync.destroy();
  });

  await stamper.clearRejectedPushes();

  await sync.markAllUnsyncedPatchesForEntityTypeAsAlreadyOnRemote(
    ACCOUNT_SESSION_ENTITY_TYPE
  );

  const stack: PatchDbStackValue = {
    db: stamper,
    sync,
    pubSub,
    decorated: stamper,
  };
  return stack;
});

export const sessionServiceAtom = atom(async (get) => {
  const stack = await get(patchDbStackAtom);
  const deviceService = await get(deviceServiceAtom);
  return createSessionService(stack.db, deviceService);
});

/**
 * One-time-per-(stack, deviceId, accountId) idempotent writes that the old
 * `patch-db-bootstrap.tsx` performed inside `registerSessionService`. Without
 * this the device row, guest profile row, and account profile row never get
 * created on cold start, and consumers (e.g. `useProfile`) see `profileId === null`.
 */
export const entityBootstrapEffect = atomEffect((get) => {
  let cancelled = false;
  void (async () => {
    const deviceService = await get(deviceServiceAtom);
    const stack = await get(patchDbStackAtom);
    const accountId = get(accountIdAtom);
    if (cancelled) return;
    const deviceId = deviceService.getDeviceId();
    await ensureDeviceEntity(stack.db, deviceId);
    if (cancelled) return;
    await ensureDeviceProfile(stack.db, deviceId);
    if (cancelled || accountId === null) return;
    await ensureAccountProfile(stack.db, accountId);
  })();
  return () => {
    cancelled = true;
  };
});
