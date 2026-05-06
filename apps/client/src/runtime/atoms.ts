import { createApiClient } from '@gamezilla/client/api/hc';
import { createPatchDbHcTransport } from '@gamezilla/client/api/patch-db-hc-transport';
import { createSecureStorage } from '@gamezilla/client/auth/create-secure-storage';
import { createDeviceService } from '@gamezilla/client/auth/device-service';
import { ensureDeviceEntity } from '@gamezilla/client/auth/ensure-device-entity';
import { ensureProfile } from '@gamezilla/client/auth/ensure-profile-entity';
import { createSessionService } from '@gamezilla/client/auth/session-service';
import { readSessionToken } from '@gamezilla/client/auth/session-token-storage';
import { createKeyValueStorage } from '@gamezilla/client/runtime/create-key-value-storage';
import {
  ACCOUNT_SESSION_ENTITY_TYPE,
  assertDeviceId,
} from '@gamezilla/domain/auth';
import { createConfigService } from '@gamezilla/domain/config/config-service';
import type { KeyValueStorage } from '@gamezilla/lib/key-value-storage/interface';
import { createLogger } from '@gamezilla/lib/logger/logger';
import { InMemoryPubSub } from '@gamezilla/lib/pub-sub/impl-in-memory';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';
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
import { openSqlClientForPlatform } from './open-sql-client';

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
  const sql = await openSqlClientForPlatform({
    getAccountId: () => get(accountIdAtom),
    getDeviceId: () => deviceService.getDeviceId(),
  });
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
 * Device row + profile for current {@link myId} (`accountId` when signed in,
 * else install id).
 */
export const entityBootstrapEffect = atomEffect((get) => {
  let cancelled = false;
  void (async () => {
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
  })();
  return () => {
    cancelled = true;
  };
});
