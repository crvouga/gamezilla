import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { PatchDbImplClientTransport } from '@gamezilla/patch-db/impl-client-transport';
import { PatchDbImplSqlite } from '@gamezilla/patch-db/impl-sqlite/impl-sqlite';
import { PATCHES_DB_TOPIC, SyncPatchDb } from '@gamezilla/patch-db/impl-sync';
import { PatchMetadataStamper } from '@gamezilla/patch-db/metadata/patch-metadata-stamper';
import type { PatchDbStackValue } from '@gamezilla/patch-db/react';
import type { SubscribablePatchDbLike } from '@gamezilla/patch-db/subscribable';
import { hydrateInMemoryStoreFromSqlite } from '@gamezilla/patch-db/react/hydrate-in-memory-store';
import { InMemoryEntityStore } from '@gamezilla/patch-db/react/in-memory-entity-store';
import { setInMemoryStoreForDb } from '@gamezilla/patch-db/react/in-memory-store-registry';
import { PatchDbWriteThroughMirror } from '@gamezilla/patch-db/react/write-through-mirror';
import { InMemoryPubSub } from '@gamezilla/lib/pub-sub/impl-in-memory';
import { getRuntimeFactories } from '@gamezilla/auth/client/runtime-factories';
import type { ConfigService } from '@gamezilla/auth/client/config-service-types';
import type { DeviceService } from '@gamezilla/auth/client/device-service';

import { registerPatchStackCleanup } from './sql-client-lifecycle';

// eslint-disable-next-line max-lines-per-function -- mirrors legacy stack setup; kept linear for parity with production behavior
export async function createPatchDbStack(args: {
  sql: SqlClient;
  config: ConfigService;
  deviceService: DeviceService;
  storage: SecureStorage;
  signal: AbortSignal;
  getSessionToken: () => string | null;
  setSessionToken: (token: string | null) => void;
  getAccountId: () => string | null;
}): Promise<PatchDbStackValue> {
  const {
    sql,
    config,
    deviceService,
    storage,
    signal,
    getSessionToken,
    setSessionToken,
    getAccountId,
  } = args;
  const factories = getRuntimeFactories();

  const persistedToken = await factories.readSessionToken(storage);
  if (persistedToken !== null) {
    setSessionToken(persistedToken);
  }

  const local = new PatchDbImplSqlite(sql);
  await local.migrate();

  const installId = deviceService.getDeviceId();
  factories.assertDeviceId(installId);

  const transport = factories.createPatchDbHcTransport(
    factories.createApiClient(config.getApiUrl()),
    {
      patchDbBaseUrl: `${config.getApiUrl()}/patch-db`,
      getAuthToken: () => getSessionToken(),
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
      const aid = getAccountId();
      return aid !== null && aid.length > 0 ? aid : installId;
    },
    assertDeviceId: (id) => factories.assertDeviceId(id),
  });

  const store = new InMemoryEntityStore();
  await hydrateInMemoryStoreFromSqlite(local, store);

  const decorated = new PatchDbWriteThroughMirror(stamper, store);
  setInMemoryStoreForDb(decorated as SubscribablePatchDbLike, store);

  const pollMirrorUnsub = pubSub.subscribe(PATCHES_DB_TOPIC, () => {
    void hydrateInMemoryStoreFromSqlite(local, store);
  });

  registerPatchStackCleanup({
    decorated: decorated as SubscribablePatchDbLike,
    sync,
    signal,
  });
  signal.addEventListener('abort', () => pollMirrorUnsub());

  await stamper.clearRejectedPushes();

  await sync.markAllUnsyncedPatchesForEntityTypeAsAlreadyOnRemote(
    factories.accountSessionEntityType
  );

  return {
    db: decorated,
    sync,
    pubSub,
    decorated,
  };
}
