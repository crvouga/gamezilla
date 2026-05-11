import type { ConfigService } from '@gamezilla/auth/client/config-service-types';
import type { DeviceService } from '@gamezilla/auth/client/device-service';
import { readSessionToken } from '@gamezilla/auth/client/session-token-storage';
import {
  ACCOUNT_SESSION_ENTITY_TYPE,
  assertDeviceId,
} from '@gamezilla/auth/shared';
import { InMemoryPubSub } from '@gamezilla/lib/pub-sub/impl-in-memory';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { PatchDbImplClientTransport } from '@gamezilla/patch-db/impl-client-transport';
import { PatchDbImplSqlite } from '@gamezilla/patch-db/impl-sqlite/impl-sqlite';
import { PATCHES_DB_TOPIC, SyncPatchDb } from '@gamezilla/patch-db/impl-sync';
import { PatchMetadataStamper } from '@gamezilla/patch-db/metadata/patch-metadata-stamper';
import type { PatchDbValue } from '@gamezilla/patch-db/react';
import { hydrateInMemoryStoreFromSqlite } from '@gamezilla/patch-db/react/hydrate-in-memory-store';
import { InMemoryEntityStore } from '@gamezilla/patch-db/react/in-memory-entity-store';
import { setInMemoryStoreForDb } from '@gamezilla/patch-db/react/in-memory-store-registry';
import { PatchDbWriteThroughMirror } from '@gamezilla/patch-db/react/write-through-mirror';
import type { SubscribablePatchDbLike } from '@gamezilla/patch-db/subscribable';

import type { ApiClient } from '../api/hc';
import { createPatchDbHcTransport } from '../api/patch-db-hc-transport';

export type CreatePatchDbArgs = {
  sql: SqlClient;
  config: ConfigService;
  deviceService: DeviceService;
  storage: SecureStorage;
  getSessionToken: () => string | null;
  setSessionToken: (token: string | null) => void;
  getAccountId: () => string | null;
  apiClient: ApiClient;
};

/**
 * Builds the single, app-lifetime patch-db on top of an already-open `SqlClient`:
 * sqlite local + remote sync transport + in-memory entity mirror.
 *
 * Compared to the old "stack" plumbing this does *not* register cleanups, accept
 * an `AbortSignal`, or coordinate with a SQL lifecycle queue — there is exactly
 * one of these per process and it lives until the app dies.
 */
export async function createPatchDb(
  args: CreatePatchDbArgs
): Promise<PatchDbValue> {
  const persistedToken = await readSessionToken(args.storage);
  if (persistedToken !== null) {
    args.setSessionToken(persistedToken);
  }

  const local = new PatchDbImplSqlite(args.sql);
  await local.migrate();

  const installId = args.deviceService.getDeviceId();
  assertDeviceId(installId);

  const remote = new PatchDbImplClientTransport(
    createPatchDbHcTransport(args.apiClient, {
      patchDbBaseUrl: `${args.config.getApiUrl()}/patch-db`,
      getAuthToken: () => args.getSessionToken(),
      getAnonId: () => installId,
    })
  );

  const pubSub = new InMemoryPubSub();
  const sync = new SyncPatchDb(local, remote, pubSub, {
    pushIntervalMs: 2000,
    pollIntervalMs: 5000,
  });

  const stamper = new PatchMetadataStamper(sync, {
    getDeviceId: () => installId,
    getMyId: () => {
      const aid = args.getAccountId();
      return aid !== null && aid.length > 0 ? aid : installId;
    },
    assertDeviceId: (id) => assertDeviceId(id),
  });

  const store = new InMemoryEntityStore();
  await hydrateInMemoryStoreFromSqlite(local, store);

  const decorated = new PatchDbWriteThroughMirror(stamper, store);
  setInMemoryStoreForDb(decorated as SubscribablePatchDbLike, store);

  // Re-hydrate the in-memory mirror whenever the sync engine writes new patches.
  // No teardown: the patch-db lives for the entire app lifetime.
  pubSub.subscribe(PATCHES_DB_TOPIC, () => {
    void hydrateInMemoryStoreFromSqlite(local, store);
  });

  await stamper.clearRejectedPushes();
  await sync.markAllUnsyncedPatchesForEntityTypeAsAlreadyOnRemote(
    ACCOUNT_SESSION_ENTITY_TYPE
  );

  return {
    db: decorated as SubscribablePatchDbLike,
    sync,
    pubSub,
  };
}
