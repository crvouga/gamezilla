import type { AuthContext } from '@libs/auth/server/types';
import { appAuth } from '@libs/auth/shared/auth-context';
import { mapAppAuthToUploadAuth } from '@libs/auth/shared/map-app-auth-to-upload-auth';
import { SPACE_USERS_TABLE, SPACES_TABLE } from '@libs/db/shared/space-tables';
import { stripServerOwnedProfileUploadColumns } from '@libs/profile/shared/strip-server-owned-profile-upload-columns';
import { loadMemberOfSpaceIdsFromSql } from '@libs/spaces/server/load-member-of-space-ids-sql';
import { assert } from '@pkgs/assert';
import { runRules } from '@pkgs/rules/core/run-rules';
import { isRulesReject } from '@pkgs/rules/core/rules-reject';
import type { Failure } from '@pkgs/rules/core/types';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { ApplyBatchReject } from '@pkgs/sync-engine/server/apply-batch';
import { processUploadWithRules } from '@pkgs/sync-engine/server/process-upload-with-rules';
import { parseUploadBody } from '@pkgs/sync-engine/server/upload-handler';
import type { UploadAuth } from '@pkgs/sync-engine/shared/rules-auth';
import type {
  UploadBatch,
  UploadRow,
} from '@pkgs/sync-engine/shared/upload-batch';
import type { Context } from 'hono';
import { Hono } from 'hono';

import type { ApiHonoEnv } from '../app/api-hono-types';
import { apiRequestAsyncLocalStorage } from '../request-scope';
import { APP_RULES } from './app-rules';
import { APP_TABLE_POLICIES } from './table-policies';
import { recordUploadRejection } from './upload-rejection-metrics';

function uploadTablePriority(table: string): number {
  if (table === SPACES_TABLE.tableName) return 0;
  if (table === SPACE_USERS_TABLE.tableName) return 1;
  return 2;
}

/** Parent tables before children so create-space FK applies in one pass. */
function orderUploadRowsForParentsFirst(
  rows: readonly UploadRow[]
): UploadRow[] {
  return [...rows].sort(
    (a, b) => uploadTablePriority(a.table) - uploadTablePriority(b.table)
  );
}

async function resolveUploadAuth(request: Request): Promise<UploadAuth | null> {
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
  return mapAppAuthToUploadAuth(auth, memberOfSpaceIds);
}

function openRequestSqlClient(): SqlClient {
  const requestStore = apiRequestAsyncLocalStorage.getStore();
  assert.defined(requestStore, 'sync upload sql: request store missing');
  const inner = requestStore.sqlClient;
  return {
    connect: () => inner.connect(),
    disconnect: () => Promise.resolve(),
    query: (query) => inner.query(query),
    run: (query) => inner.run(query),
    transaction: (fn) => inner.transaction(fn),
    prepare: (query) => inner.prepare(query),
  };
}

function readAppVersion(request: Request): string {
  const header = request.headers.get('x-app-version');
  if (header !== null && header.length > 0) return header;
  return 'unknown';
}

function recordFailures(
  failures: readonly Failure[],
  appVersion: string
): void {
  for (const failure of failures) {
    recordUploadRejection(failure.code, appVersion);
  }
}

function prepareUploadBatch(batch: UploadBatch): UploadBatch {
  return {
    rows: orderUploadRowsForParentsFirst(
      batch.rows.map(stripServerOwnedProfileUploadColumns)
    ),
  };
}

async function handleSyncUpload(
  c: Context<ApiHonoEnv<AuthContext>>
): Promise<Response> {
  const auth = await resolveUploadAuth(c.req.raw);
  if (auth === null) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  const batch = prepareUploadBatch(parseUploadBody(await c.req.json()));
  const sql = openRequestSqlClient();
  const appVersion = readAppVersion(c.req.raw);

  try {
    await processUploadWithRules({
      db: sql,
      auth,
      batch,
      policies: APP_TABLE_POLICIES,
      lockUserId: auth.userId,
      runRules: async ({ phase, auth: uploadAuth, batch: b, db }) => {
        await runRules(
          {
            phase,
            auth: {
              userId: uploadAuth.userId,
              accountId: uploadAuth.accountId,
              deviceId: uploadAuth.deviceId,
            },
            batch: b,
            db,
          },
          APP_RULES
        );
      },
    });
    return c.json({ ok: true }, 200);
  } catch (e) {
    if (isRulesReject(e) || e instanceof ApplyBatchReject) {
      const failures = e.failures;
      recordFailures(failures, appVersion);
      return c.json({ discard: true, failures }, 409);
    }
    throw e;
  }
}

/** PowerSync client upload endpoint (`POST /sync/upload`). */
export function createSyncRoutes() {
  return new Hono<ApiHonoEnv<AuthContext>>().post(
    '/sync/upload',
    handleSyncUpload
  );
}
