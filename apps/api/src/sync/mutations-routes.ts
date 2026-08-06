import { assert } from '@pkgs/assert';
import type { PubSub } from '@pkgs/pubsub/interface';
import { PubSubNotSupportedError } from '@pkgs/pubsub/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { createMutationsRoutes as createSyncMutationsRoutes } from '@pkgs/sync-engine/server/create-mutations-routes';

import { apiRequestAsyncLocalStorage } from '../request-scope';
import { getApiPubSub } from './api-pubsub';
import { APP_MUTATIONS } from './app-mutations';
import { resolveSessionReplayAuth } from './query-auth';

function openRequestSqlClient(): SqlClient {
  const requestStore = apiRequestAsyncLocalStorage.getStore();
  assert.defined(requestStore, 'mutations sql: request store missing');
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

/** `POST /api/mutations` — product mount over the sync-engine Hono factory. */
export function createMutationsRoutes() {
  return createSyncMutationsRoutes({
    resolveAuth: resolveSessionReplayAuth,
    getSql: openRequestSqlClient,
    registry: APP_MUTATIONS,
    pubsub: createRequestScopedPubSub(),
  });
}
