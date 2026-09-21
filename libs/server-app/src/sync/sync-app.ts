import type { ComposedFeatures } from '@libs/feature/public/compose';
import { authorizeAppMutation } from '@libs/permissions/root/server/authorize-app-mutation';
import { HttpPubSubFromSecretStore } from '@libs/pubsub/root/server/create-http-pubsub-from-secret-store';
import { assert } from '@pkgs/assert';
import type { PubSub } from '@pkgs/pubsub/interface';
import { PubSubNotSupportedError } from '@pkgs/pubsub/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { createSyncApp as createSyncEngineApp } from '@pkgs/sync-engine/server';
import { apiRequestAsyncLocalStorage } from '../request-scope';
import { resolveSessionReplayAuth } from './query-auth';

function openRequestSqlClient(): SqlClient {
  const requestStore = apiRequestAsyncLocalStorage.getStore();
  assert.defined(requestStore, 'sync sql: request store missing');
  return requestStore.sqlClient;
}

/** Resolves EMQX HTTP pubsub from the current request's secret store. */
function createRequestScopedPubSub(): PubSub {
  return {
    async publish(topic, data) {
      const store = apiRequestAsyncLocalStorage.getStore();
      if (store === undefined) return;
      const pubsub = await new HttpPubSubFromSecretStore(
        store.secretStore
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
  /** Enables dev-only query limit strictness (injected from `ServerEnv.secretsEnv`). */
  readonly strictQueryLimits?: boolean;
}) {
  let checkpointSeq = 0;
  const mutations = await deps.app.mutations();
  return createSyncEngineApp({
    resolveAuth: resolveSessionReplayAuth,
    getSql: openRequestSqlClient,
    queries: deps.app.queries,
    mutations,
    authorizeMutation: authorizeAppMutation,
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
