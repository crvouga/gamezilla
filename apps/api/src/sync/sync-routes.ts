import { mapAppAuthToWriteContext } from '@libs/auth/server/write-policies';
import type { AuthContext } from '@libs/auth/server/types';
import { appAuth } from '@libs/auth/shared/auth-context';
import { loadMemberOfSpaceIdsFromSql } from '@libs/spaces/server/load-member-of-space-ids-sql';
import { assert } from '@pkgs/assert';
import {
  createUploadHandler,
  type WritePolicyContext,
} from '@pkgs/sync-engine/server/upload-handler';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { Hono } from 'hono';

import type { ApiHonoEnv } from '../app/api-hono-types';
import { apiRequestAsyncLocalStorage } from '../request-scope';
import { SYNC_WRITE_POLICY_REGISTRY } from './write-policies-registry';

export type SyncUploadAuth = {
  readonly writeContext: WritePolicyContext;
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

const uploadHandler = createUploadHandler<SyncUploadAuth>({
  resolveAuth: async (c) => resolveSyncUploadAuth(c.req.raw),
  mapAuth: (auth) => auth.writeContext,
  policies: SYNC_WRITE_POLICY_REGISTRY,
  openSql: openRequestSqlClient,
});

/** PowerSync client upload endpoint (`POST /sync/upload`). */
export function createSyncRoutes() {
  return new Hono<ApiHonoEnv<AuthContext>>().post('/sync/upload', uploadHandler);
}
