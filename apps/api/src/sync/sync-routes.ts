import { mapAppAuthToWriteContext } from '@libs/auth/shared/map-app-auth-to-write-context';
import type { AuthContext } from '@libs/auth/server/types';
import { appAuth } from '@libs/auth/shared/auth-context';
import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import { loadMemberOfSpaceIdsFromSql } from '@libs/spaces/server/load-member-of-space-ids-sql';
import { assert } from '@pkgs/assert';
import {
  parseUploadBody,
  processUploadBatch,
} from '@pkgs/sync-engine/server/upload-handler';
import type {
  UploadRow,
  UploadRowResult,
} from '@pkgs/sync-engine/shared/upload-batch';
import { createRowEvaluator } from '@pkgs/write/server/row-write-registry';
import type { WriteContext } from '@pkgs/write/shared/write-context';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { Context } from 'hono';
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
  const requestStore = apiRequestAsyncLocalStorage.getStore();
  assert.defined(requestStore, 'sync upload: request store missing');
  const ctx = await requestStore.sessionAuth.resolveAuthContext(
    requestStore.sqlClient,
    request
  );
  const auth = appAuth(ctx);
  if (auth === null || auth.deviceId === '') return null;
  const memberOfSpaceIds = await loadMemberOfSpaceIdsFromSql(
    requestStore.sqlClient,
    auth.myId
  );
  return { writeContext: mapAppAuthToWriteContext(auth, memberOfSpaceIds) };
}

function openRequestSqlClient(): Promise<SqlClient> {
  const requestStore = apiRequestAsyncLocalStorage.getStore();
  assert.defined(requestStore, 'sync upload sql: request store missing');
  const inner = requestStore.sqlClient;
  return Promise.resolve({
    connect: () => inner.connect(),
    disconnect: () => Promise.resolve(),
    query: (sql, params) => inner.query(sql, params),
    run: (sql, params) => inner.run(sql, params),
    transaction: (fn) => inner.transaction(fn),
    prepare: (sql) => inner.prepare(sql),
  });
}

/** Username is server-owned; strip it from client sync uploads. */
function stripServerOwnedProfileColumns(row: UploadRow): UploadRow {
  if (row.table !== PROFILES_TABLE.tableName || row.values === undefined) {
    return row;
  }
  const values = { ...row.values };
  delete values[ProfileCol.username];
  delete values[ProfileCol.usernameChangedAt];
  return { ...row, values };
}

function createProfileAwareUploadRowEvaluator(): (
  ctx: WriteContext,
  row: UploadRow,
  sql: SqlClient
) => Promise<UploadRowResult> {
  const evaluateRow = createRowEvaluator(APP_ROW_WRITE_REGISTRY);
  return async (ctx, row, sql) => {
    const result = await evaluateRow(ctx, row, sql);
    // #region agent log
    if (
      result.status === 'rejected' ||
      row.table === 'spaces' ||
      row.table === 'space_memberships' ||
      row.table === 'space_participations'
    ) {
      fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c605ca'},body:JSON.stringify({sessionId:'c605ca',runId:'post-fix',hypothesisId:'H-S3',location:'sync-routes.ts:evaluateRow',message:'sync upload row decision',data:{table:row.table,op:row.op,id:row.id,status:result.status,reason:result.status==='rejected'?result.code:null,valueKeys:row.values?Object.keys(row.values):[]},timestamp:Date.now()})}).catch(()=>{});
    }
    // #endregion
    if (result.status === 'rejected') {
      return { status: 'rejected', reason: result.code };
    }
    return { status: 'accepted' };
  };
}

async function handleSyncUpload(
  c: Context<ApiHonoEnv<AuthContext>>
): Promise<Response> {
  const auth = await resolveSyncUploadAuth(c.req.raw);
  if (auth === null) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  const batch = parseUploadBody(await c.req.json());
  const strippedBatch = {
    rows: batch.rows.map(stripServerOwnedProfileColumns),
  };
  const evaluateRow = createProfileAwareUploadRowEvaluator();
  const sql = await openRequestSqlClient();
  try {
    await sql.connect();
    const out = await processUploadBatch(
      sql,
      auth.writeContext,
      evaluateRow,
      strippedBatch
    );
    // #region agent log
    for (let i = 0; i < strippedBatch.rows.length; i++) {
      const row = strippedBatch.rows[i];
      const result = out.results[i];
      if (
        row === undefined ||
        result === undefined ||
        (row.table !== 'spaces' &&
          row.table !== 'space_memberships' &&
          row.table !== 'space_participations' &&
          result.status !== 'rejected')
      ) {
        continue;
      }
      fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c605ca'},body:JSON.stringify({sessionId:'c605ca',runId:'post-fix',hypothesisId:'H-S6',location:'sync-routes.ts:applyResult',message:'sync upload apply result',data:{table:row.table,op:row.op,id:row.id,status:result.status,reason:result.status==='rejected'?result.reason:null,valueKeys:row.values?Object.keys(row.values):[]},timestamp:Date.now()})}).catch(()=>{});
    }
    // #endregion
    return c.json(out, 200);
  } finally {
    await sql.disconnect();
  }
}

/** PowerSync client upload endpoint (`POST /sync/upload`). */
export function createSyncRoutes() {
  return new Hono<ApiHonoEnv<AuthContext>>().post(
    '/sync/upload',
    handleSyncUpload
  );
}
