import { getCachedDeviceId } from '@libs/auth/client/use-device-id';
import { getCachedSessionToken } from '@libs/auth/client/use-session-token';
import { getCachedCurrentAccountId } from '@libs/auth/client/use-current-account-id';
import type { ConfigService } from '@libs/auth/client/config-service-types';
import { ACCOUNT_SESSION_ENTITY_TYPE, assertDeviceId } from '@libs/auth/shared';
import { InMemoryPubSub } from '@pkgs/pub-sub/impl-in-memory';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { PatchDbImplClientTransport } from '@pkgs/patch-db/impl-client-transport';
import { PatchDbImplSqlite } from '@pkgs/patch-db/impl-sqlite/impl-sqlite';
import { PATCHES_DB_TOPIC, SyncPatchDb } from '@pkgs/patch-db/impl-sync';
import { PatchMetadataStamper } from '@pkgs/patch-db/metadata/patch-metadata-stamper';
import type { PatchDbValue } from '@pkgs/patch-db/react';
import { hydrateInMemoryStoreFromSqlite } from '@pkgs/patch-db/react/hydrate-in-memory-store';
import { InMemoryEntityStore } from '@pkgs/patch-db/react/in-memory-entity-store';
import { setInMemoryStoreForDb } from '@pkgs/patch-db/react/in-memory-store-registry';
import { refreshPatchDbQueryCacheForDb } from '@pkgs/patch-db/react/query-cache';
import { PatchDbWriteThroughMirror } from '@pkgs/patch-db/react/write-through-mirror';
import type { SubscribablePatchDbLike } from '@pkgs/patch-db/subscribable';

import { createPatchDbHttpTransport } from '../api/patch-db-hc-transport';
import type { PatchDbHttpFetchFn } from '@pkgs/patch-db/transport/impl-http-fetch';
import { createCoalescedSqliteHydration } from './coalesced-sqlite-hydration';
import { isObservabilityActive } from '@pkgs/observability/port/is-observability-active';
import type { Observability } from '@pkgs/observability/port/observability';
import { wrapSqlClientForObservability } from '../observability/wrap-sql-client';

export type CreatePatchDbArgs = {
  sql: SqlClient;
  config: ConfigService;
  fetchFn?: PatchDbHttpFetchFn;
  observability?: Observability;
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
  const sql =
    args.observability !== undefined &&
    isObservabilityActive(args.observability)
      ? wrapSqlClientForObservability(args.observability, args.sql)
      : args.sql;
  const local = new PatchDbImplSqlite(sql);
  await local.migrate();

  const installId = getCachedDeviceId();
  assertDeviceId(installId);

  const remote = new PatchDbImplClientTransport(
    createPatchDbHttpTransport({
      patchDbBaseUrl: `${args.config.getApiUrl()}/api/patch-db`,
      getAuthToken: () => getCachedSessionToken(),
      getAnonId: () => getCachedDeviceId(),
      ...(args.fetchFn !== undefined ? { fetch: args.fetchFn } : {}),
    })
  );

  const pubSub = new InMemoryPubSub();
  const store = new InMemoryEntityStore();
  const decoratedDbHolder: { value: SubscribablePatchDbLike | undefined } = {
    value: undefined,
  };
  const sync = new SyncPatchDb(local, remote, pubSub, {
    pushIntervalMs: 2000,
    pollIntervalMs: 5000,
    onPollMerged: (results) => {
      const entities = results.flatMap((result) => result.entities);
      if (entities.length > 0) {
        store.upsertEntities(entities);
        if (decoratedDbHolder.value !== undefined) {
          refreshPatchDbQueryCacheForDb(decoratedDbHolder.value);
        }
      }
    },
  });

  const stamper = new PatchMetadataStamper(sync, {
    getDeviceId: () => installId,
    getMyId: () => {
      const aid = getCachedCurrentAccountId();
      return aid !== null && aid.length > 0 ? aid : installId;
    },
    assertDeviceId: (id) => assertDeviceId(id),
  });

  await hydrateInMemoryStoreFromSqlite(local, store);

  const decorated = new PatchDbWriteThroughMirror(stamper, store);
  const decoratedDb = decorated as SubscribablePatchDbLike;
  decoratedDbHolder.value = decoratedDb;
  setInMemoryStoreForDb(decoratedDb, store);

  pubSub.subscribe(
    PATCHES_DB_TOPIC,
    createCoalescedSqliteHydration({ local, store, decoratedDb })
  );

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
