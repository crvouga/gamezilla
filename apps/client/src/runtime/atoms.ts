import { createApiClient } from '@gamezilla/client/api/hc';
import { createPatchDbHcTransport } from '@gamezilla/client/api/patch-db-hc-transport';
import { createSecureStorage } from '@gamezilla/client/auth/create-secure-storage';
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
import { InMemoryPubSub } from '@gamezilla/lib/pub-sub/impl-in-memory';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';
import { SqlClientImplExpoSqlite } from '@gamezilla/lib/sql-client/impl-expo-sqlite';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { assertDatabaseName } from '@gamezilla/lib/sqlite';
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

export const deviceServiceAtom = atom(async (get) => {
  const storage = get(secureStorageAtom);
  return await createDeviceService(storage);
});

export const accountDbDirectoryAtom = atom(async () => {
  return await ensureAccountDatabaseDirectory();
});

const WEB_DATABASE_NAME = 'main';

/**
 * expo-sqlite on web uses a single OPFS handle per database name. If we open
 * again while {@link SqlClientImplExpoSqlite.disconnect} is still in flight
 * (Jotai abort used to use `void disconnect()`), the second open can fail and
 * recovery may try to wipe OPFS while the worker still holds the handle
 * (`NoModificationAllowedError`). Serialize opens so each new connection only
 * starts after the previous one's disconnect has finished.
 */
let webSqlMainDisconnectDone: Promise<void> = Promise.resolve();

async function openWebSqlMain(signal: AbortSignal): Promise<SqlClient> {
  await webSqlMainDisconnectDone;

  let resolveDisconnect!: () => void;
  const disconnectBarrier = new Promise<void>((r) => {
    resolveDisconnect = r;
  });
  webSqlMainDisconnectDone = disconnectBarrier;

  let settled = false;
  const settleBarrier = () => {
    if (settled) return;
    settled = true;
    resolveDisconnect();
  };

  let client: SqlClient | undefined;
  try {
    client = await SqlClientImplExpoSqlite.open(WEB_DATABASE_NAME);
    await client.connect();
    const bound = client;
    signal.addEventListener(
      'abort',
      () => {
        void bound.disconnect().finally(settleBarrier);
      },
      { once: true }
    );
    return client;
  } catch (err) {
    if (client !== undefined) {
      await client.disconnect().catch(() => {});
    }
    settleBarrier();
    throw err;
  }
}

export const sqlClientAtom = atom(async (get, { signal }) => {
  if (Platform.OS === 'web') {
    assertDatabaseName(WEB_DATABASE_NAME);
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
