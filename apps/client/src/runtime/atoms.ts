import { createGamezillaApiClient } from '@gamezilla/client/api/hc';
import { createPatchDbHcTransport } from '@gamezilla/client/api/patch-db-hc-transport';
import { createSecureStorage } from '@gamezilla/client/auth/create-secure-storage';
import { createDeviceService } from '@gamezilla/client/auth/device-service';
import { createSessionService } from '@gamezilla/client/auth/session-service';
import {
  ensureAccountDatabaseDirectory,
  openAccountDb,
  openAnonymousDb,
} from '@gamezilla/client/db/account-db';
import { ensureServerClientId } from '@gamezilla/client/db/ensure-server-client-id';
import { assertDeviceId } from '@gamezilla/domain/auth';
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

export const sqlClientAtom = atom(async (get, { signal }) => {
  if (Platform.OS === 'web') {
    assertDatabaseName(WEB_DATABASE_NAME);
    const client = await SqlClientImplExpoSqlite.open(WEB_DATABASE_NAME);
    await client.connect();
    signal.addEventListener('abort', () => {
      void client.disconnect();
    });
    return client;
  }

  await get(accountDbDirectoryAtom);
  const accountId = get(accountIdAtom);
  const storage = get(secureStorageAtom);
  const apiUrl = get(configServiceAtom).getApiUrl();

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

  const local = new PatchDbImplSqlite(sql);
  await local.migrate();

  const transport = createPatchDbHcTransport(
    createGamezillaApiClient(config.getApiUrl()),
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
