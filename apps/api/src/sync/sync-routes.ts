import { mapAppAuthToWriteContext } from '@libs/auth/shared/map-app-auth-to-write-context';
import type { AuthContext } from '@libs/auth/server/types';
import { appAuth } from '@libs/auth/shared/auth-context';
import { loadMemberOfSpaceIdsFromSql } from '@libs/spaces/server/load-member-of-space-ids-sql';
import { assert } from '@pkgs/assert';
import { createWriteAuthorizedUploadHandler } from '@pkgs/sync-engine/server/create-write-authorized-upload-handler';
import type { WriteContext } from '@pkgs/write/shared/write-context';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { Hono } from 'hono';

import type { ApiHonoEnv } from '../app/api-hono-types';
import { apiRequestAsyncLocalStorage } from '../request-scope';
import { APP_ROW_WRITE_REGISTRY } from './row-write-registry';

export type SyncUploadAuth = {
  readonly writeContext: WriteContext;
};

async function resolveSyncUploadAuth(
  request: Request
): Promise<SyncUploadAuth | null> {
  const store = apiRequestAsyncLocalStorage.getStore();
  assert.defined(store, 'sync upload: request store missing');
  const ctx = await store.sessionAuth.resolveAuthContext(
    store.sqlClient,
    request
  );
  const auth = appAuth(ctx);
  if (auth === null || auth.deviceId === '') return null;
  const memberOfSpaceIds = await loadMemberOfSpaceIdsFromSql(
    store.sqlClient,
    auth.myId
  );
  return { writeContext: mapAppAuthToWriteContext(auth, memberOfSpaceIds) };
}

function openRequestSqlClient(): Promise<SqlClient> {
  const store = apiRequestAsyncLocalStorage.getStore();
  assert.defined(store, 'sync upload sql: request store missing');
  const inner = store.sqlClient;
  return Promise.resolve({
    connect: () => inner.connect(),
    disconnect: () => Promise.resolve(),
    query: (sql, params) => inner.query(sql, params),
    run: (sql, params) => inner.run(sql, params),
    transaction: (fn) => inner.transaction(fn),
    prepare: (sql) => inner.prepare(sql),
  });
}

const uploadHandler = createWriteAuthorizedUploadHandler({
  resolveAuth: async (c) => resolveSyncUploadAuth(c.req.raw),
  mapAuth: (auth) => auth.writeContext,
  rowRegistry: APP_ROW_WRITE_REGISTRY,
  openSql: openRequestSqlClient,
});

/** PowerSync client upload endpoint (`POST /sync/upload`). */
export function createSyncRoutes() {
  return new Hono<ApiHonoEnv<AuthContext>>().post(
    '/sync/upload',
    uploadHandler
  );
}
