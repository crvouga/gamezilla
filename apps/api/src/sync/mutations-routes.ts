import { assert } from '@pkgs/assert';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { createMutationsRoutes as createSyncMutationsRoutes } from '@pkgs/sync-engine/server/create-mutations-routes';

import { apiRequestAsyncLocalStorage } from '../request-scope';
import { APP_MUTATIONS } from './app-mutations';
import { resolveSessionReplayAuth } from './query-auth';

function openRequestSqlClient(): SqlClient {
  const requestStore = apiRequestAsyncLocalStorage.getStore();
  assert.defined(requestStore, 'mutations sql: request store missing');
  return requestStore.sqlClient;
}

/** `POST /api/mutations` — product mount over the sync-engine Hono factory. */
export function createMutationsRoutes() {
  return createSyncMutationsRoutes({
    resolveAuth: resolveSessionReplayAuth,
    getSql: openRequestSqlClient,
    registry: APP_MUTATIONS,
  });
}
