import { mapAppAuthToWriteContext } from '@libs/auth/shared/map-app-auth-to-write-context';
import type { AuthContext } from '@libs/auth/server/types';
import { appAuth } from '@libs/auth/shared/auth-context';
import { loadMemberOfSpaceIdsFromSql } from '@libs/spaces/server/load-member-of-space-ids-sql';
import {
  SPACE_MEMBERSHIPS_TABLE,
  SpaceMembershipCol,
} from '@libs/db/shared/space-tables';
import { maybeAutoEndEmptyHostSpace } from '@libs/spaces/shared/space-write-helpers';
import { stripServerOwnedProfileUploadColumns } from '@libs/profile/shared/strip-server-owned-profile-upload-columns';
import { assert } from '@pkgs/assert';
import {
  applyRow,
  parseUploadBody,
} from '@pkgs/sync-engine/server/upload-handler';
import type {
  UploadBatch,
  UploadBatchResult,
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
    query: (query) => inner.query(query),
    run: (query) => inner.run(query),
    transaction: (fn) => inner.transaction(fn),
    prepare: (query) => inner.prepare(query),
  });
}

function isMembershipLeaveUpload(row: UploadRow): boolean {
  if (row.table !== SPACE_MEMBERSHIPS_TABLE.tableName) return false;
  if (row.op === 'delete') return false;
  const leftAt = row.values?.[SpaceMembershipCol.leftAt];
  return typeof leftAt === 'string' && leftAt.length > 0;
}

function spaceIdFromMembershipUpload(row: UploadRow): string | null {
  const fromValues = row.values?.[SpaceMembershipCol.spaceId];
  if (typeof fromValues === 'string' && fromValues.length > 0) {
    return fromValues;
  }
  const sep = row.id.indexOf(':');
  if (sep <= 0 || sep >= row.id.length - 1) return null;
  return row.id.slice(sep + 1);
}

/**
 * Authorize + apply each row. Membership leaves also run
 * {@link maybeAutoEndEmptyHostSpace} — raw CRUD patches only set `left_at`,
 * which otherwise left host spaces live forever and inflated miniplayer counts.
 */
async function processSyncUploadBatch(
  sql: SqlClient,
  ctx: WriteContext,
  batch: UploadBatch
): Promise<UploadBatchResult> {
  const evaluateRow = createRowEvaluator(APP_ROW_WRITE_REGISTRY);
  const results: UploadRowResult[] = [];
  for (const row of batch.rows) {
    const decision = await evaluateRow(ctx, row, sql);
    if (decision.status === 'rejected') {
      results.push({ status: 'rejected', reason: decision.code });
      continue;
    }
    try {
      await applyRow(sql, row);
      if (isMembershipLeaveUpload(row)) {
        const spaceId = spaceIdFromMembershipUpload(row);
        if (spaceId !== null) {
          await maybeAutoEndEmptyHostSpace(ctx, sql, spaceId);
        }
      }
      results.push({ status: 'accepted' });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      results.push({ status: 'rejected', reason: message });
    }
  }
  return { results };
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
    rows: batch.rows.map(stripServerOwnedProfileUploadColumns),
  };
  const sql = await openRequestSqlClient();
  try {
    await sql.connect();
    const out = await processSyncUploadBatch(
      sql,
      auth.writeContext,
      strippedBatch
    );
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
