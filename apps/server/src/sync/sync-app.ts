import { HttpPubSubFromSecretStore } from '@libs/pubsub/root/server/create-http-pubsub-from-secret-store';
import { appTopicMap } from '@libs/runtime/root/app-topic-map';
import { assert } from '@pkgs/assert';
import type { PubSub } from '@pkgs/pubsub/interface';
import { PubSubNotSupportedError } from '@pkgs/pubsub/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { createSyncApp as createSyncEngineApp } from '@pkgs/sync-engine/server';
import { apiRequestAsyncLocalStorage } from '../request-scope';
import { APP_MUTATIONS } from './app-mutations';
import { APP_QUERIES } from './app-queries';
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

/** Product mount: `POST /api/query` (batch body), `/api/mutations`. */
export function createSyncApp(deps: {
  readonly now: () => number;
  readonly createId: () => string;
  /** Enables dev-only query limit strictness (injected from `ServerEnv.secretsEnv`). */
  readonly strictQueryLimits?: boolean;
}) {
  let checkpointSeq = 0;
  return createSyncEngineApp({
    resolveAuth: resolveSessionReplayAuth,
    getSql: openRequestSqlClient,
    queries: APP_QUERIES,
    mutations: APP_MUTATIONS,
    now: deps.now,
    createId: deps.createId,
    pubsub: createRequestScopedPubSub(),
    rowImageFanout: true,
    topicMap: appTopicMap,
    nextCheckpoint: () => {
      checkpointSeq += 1;
      return `${String(deps.now())}${String(checkpointSeq).padStart(6, '0')}`;
    },
    ...(deps.strictQueryLimits === true ? { strictQueryLimits: true } : {}),
  });
}
