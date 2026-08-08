import { appTopicMap } from '@libs/db/shared/app-topic-map';
import { assert } from '@pkgs/assert';
import type { PubSub } from '@pkgs/pubsub/interface';
import { PubSubNotSupportedError } from '@pkgs/pubsub/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { createSyncApp as createSyncEngineApp } from '@pkgs/sync-engine/server';

import { apiRequestAsyncLocalStorage } from '../request-scope';
import { getApiPubSub } from './api-pubsub';
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
      const pubsub = await getApiPubSub(store.secretStore);
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
export function createSyncApp() {
  return createSyncEngineApp({
    resolveAuth: resolveSessionReplayAuth,
    getSql: openRequestSqlClient,
    queries: APP_QUERIES,
    mutations: APP_MUTATIONS,
    pubsub: createRequestScopedPubSub(),
    rowImageFanout: true,
    topicMap: appTopicMap,
    ...(process.env['SECRETS_ENV'] === 'dev'
      ? { strictQueryLimits: true }
      : {}),
  });
}
