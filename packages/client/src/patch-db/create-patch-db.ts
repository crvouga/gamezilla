import { getCachedDeviceId } from '@gamezilla/auth/client/use-device-id';
import { getCachedSessionToken } from '@gamezilla/auth/client/use-session-token';
import { getCachedCurrentAccountId } from '@gamezilla/auth/client/use-current-account-id';
import type { ConfigService } from '@gamezilla/auth/client/config-service-types';
import {
  ACCOUNT_SESSION_ENTITY_TYPE,
  assertDeviceId,
} from '@gamezilla/auth/shared';
import { InMemoryPubSub } from '@gamezilla/lib/pub-sub/impl-in-memory';
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
  apiClient: ApiClient;
};

/**
 * Builds the single, app-lifetime patch-db on top of an already-open
 * `SqlClient`. Auth identity (deviceId / sessionToken / accountId) is read
 * lazily from the secure-storage cache (`getCachedSecureStorageValue`) so the
 * transport rotates seamlessly across sign-in / sign-out without rebuilding.
 *
 * One per process, lives until the app dies.
 */
export async function createPatchDb(
  args: CreatePatchDbArgs
): Promise<PatchDbValue> {
  const local = new PatchDbImplSqlite(args.sql);
  await local.migrate();

  const installId = getCachedDeviceId();
  assertDeviceId(installId);

  const remote = new PatchDbImplClientTransport(
    createPatchDbHcTransport(args.apiClient, {
      patchDbBaseUrl: `${args.config.getApiUrl()}/patch-db`,
      getAuthToken: () => getCachedSessionToken(),
      getAnonId: () => getCachedDeviceId(),
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
      const aid = getCachedCurrentAccountId();
      return aid !== null && aid.length > 0 ? aid : installId;
    },
    assertDeviceId: (id) => assertDeviceId(id),
  });

  const store = new InMemoryEntityStore();
  await hydrateInMemoryStoreFromSqlite(local, store);

  const decorated = new PatchDbWriteThroughMirror(stamper, store);
  setInMemoryStoreForDb(decorated as SubscribablePatchDbLike, store);

  pubSub.subscribe(PATCHES_DB_TOPIC, () => {
    void hydrateInMemoryStoreFromSqlite(local, store);
  });

  await stamper.clearRejectedPushes();
  // accountSession is now strictly server-managed (system context only); drop
  // any locally-pending rows the old client logic might have created.
  await sync.markAllUnsyncedPatchesForEntityTypeAsAlreadyOnRemote(
    ACCOUNT_SESSION_ENTITY_TYPE
  );

  return {
    db: decorated as SubscribablePatchDbLike,
    sync,
    pubSub,
  };
}
