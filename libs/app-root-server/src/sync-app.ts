import { resolveSessionReplayAuth } from '@libs/app-root-shared/query-auth';
import { apiRequestAsyncLocalStorage } from '@libs/app-root-shared/request-scope';
import type { ComposedFeatures } from '@libs/feature-shared/compose';
import { authorizeAppMutation } from '@libs/permissions-shared/authorize-app-mutation';
import { HttpPubSubFromSecretStore } from '@libs/pubsub-server/create-http-pubsub-from-secret-store';
import { assert } from '@pkgs/assert-root-shared/singleton';
import type { PubSub } from '@pkgs/pubsub-root-shared/interface';
import { PubSubNotSupportedError } from '@pkgs/pubsub-root-shared/pubsub-not-supported-error';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import { createSyncApp as createSyncEngineApp } from '@pkgs/sync-engine-server/create-sync-app';

function openRequestSqlClient(): SqlClient {
  const requestStore = apiRequestAsyncLocalStorage.getStore();
  assert.defined(requestStore, 'sync sql: request store missing');
  return requestStore.sqlClient;
}

/** Resolves the publish-only invalidation client from the request secret store. */
function createRequestScopedPubSub(): PubSub {
  return {
    async publish(topic, data) {
      const store = apiRequestAsyncLocalStorage.getStore();
      if (store === undefined) return;
      const pubsub = await new HttpPubSubFromSecretStore(
        store.secretStore,
        () => store.clock.now()
      ).get();
      if (pubsub === undefined) return;
      await pubsub.publish(topic, data);
    },
    subscribe() {
      throw new PubSubNotSupportedError('API pubsub is publish-only');
    },
    status: () => 'connected',
    onStatus: () => () => undefined,
    close: () => undefined,
  };
}

/**
 * Sync mount: `POST /api/query` (batch body), `/api/mutations`.
 *
 * Serves exactly what the composed features declared — the whole product on
 * the API, one bounded context in a subsystem harness.
 */
export async function createSyncApp(deps: {
  /** The folded feature set: schema, queries, wake topics, mutations. */
  readonly app: ComposedFeatures;
  readonly now: () => number;
  readonly createId: () => string;
  /** Enables dev-only query limit strictness (on unless `ServerEnv.protection` is `production`). */
  readonly strictQueryLimits?: boolean;
}) {
  let checkpointSeq = 0;
  const mutations = await deps.app.mutations();
  return createSyncEngineApp({
    resolveAuth: resolveSessionReplayAuth,
    getSql: openRequestSqlClient,
    queries: deps.app.queries,
    mutations,
    authorizeMutation: async (ctx) => {
      await authorizeAppMutation(ctx);
      await deps.app.authorizeMutation(ctx);
    },
    now: deps.now,
    createId: deps.createId,
    pubsub: createRequestScopedPubSub(),
    rowImageFanout: true,
    topicMap: deps.app.topicMap,
    nextCheckpoint: () => {
      checkpointSeq += 1;
      return `${String(deps.now())}${String(checkpointSeq).padStart(6, '0')}`;
    },
    ...(deps.strictQueryLimits === true ? { strictQueryLimits: true } : {}),
  });
}
