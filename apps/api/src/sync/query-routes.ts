import { assert } from '@pkgs/assert';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { createQueryRoutes as createSyncQueryRoutes } from '@pkgs/sync-engine/server/create-query-routes';

import { apiRequestAsyncLocalStorage } from '../request-scope';
import { APP_QUERIES } from './app-queries';
import { resolveSessionReplayAuth } from './query-auth';

function openRequestSqlClient(): SqlClient {
  const requestStore = apiRequestAsyncLocalStorage.getStore();
  assert.defined(requestStore, 'query sql: request store missing');
  return requestStore.sqlClient;
}

/** `POST /api/query` — product mount over the sync-engine Hono factory. */
export function createQueryRoutes() {
  return createSyncQueryRoutes({
    resolveAuth: resolveSessionReplayAuth,
    getSql: openRequestSqlClient,
    registry: APP_QUERIES,
  });
}
