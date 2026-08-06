import type { AuthContext } from '@libs/auth/server/types';
import { appAuth } from '@libs/auth/shared/auth-context';
import { tablePolicyFor } from '@libs/db/shared/table-policy';
import { assert } from '@pkgs/assert';
import { processUploadWithMutations } from '@pkgs/mutations/server/process-upload-with-mutations';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { parseUploadBody } from '@pkgs/sync-engine/server/upload-handler';
import type { UploadRow } from '@pkgs/sync-engine/shared/upload-batch';
import type { Context } from 'hono';
import { Hono } from 'hono';

import type { ApiHonoEnv } from '../app/api-hono-types';
import { apiRequestAsyncLocalStorage } from '../request-scope';
import { APP_MUTATIONS } from './app-mutations';

async function resolveReplayAuth(request: Request) {
  const requestStore = apiRequestAsyncLocalStorage.getStore();
  assert.defined(requestStore, 'sync upload: request store missing');
  const ctx = await requestStore.sessionAuth.resolveAuthContext(
    requestStore.sqlClient,
    request
  );
  const auth = appAuth(ctx);
  if (auth === null || auth.deviceId === '' || auth.myId.length === 0) {
    return null;
  }
  return {
    actorId: auth.myId,
    deviceId: auth.deviceId,
    accountId: auth.accountId,
    isAnon: auth.isAnon,
  };
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

function uploadRowToCrud(row: UploadRow) {
  return {
    table: row.table,
    op: row.op.toUpperCase(),
    id: row.id,
    data: {
      id: row.id,
      ...(row.values ?? {}),
    },
  };
}

async function acquireUploadAdvisoryLock(
  tx: SqlClient,
  lockUserId: string
): Promise<void> {
  try {
    await tx.run(
      sql<void>`SELECT pg_advisory_xact_lock(hashtext(${lockUserId}))`
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (
      message.includes('no such function') ||
      message.includes('pg_advisory_xact_lock') ||
      message.includes('hashtext')
    ) {
      return;
    }
    throw e;
  }
}

function asNestedTxClient(tx: SqlClient): SqlClient {
  return {
    connect: () => tx.connect(),
    disconnect: () => Promise.resolve(),
    query: (q) => tx.query(q),
    run: (q) => tx.run(q),
    transaction: async (fn) => fn(tx),
    prepare: (q) => tx.prepare(q),
  };
}

async function handleSyncUpload(
  c: Context<ApiHonoEnv<AuthContext>>
): Promise<Response> {
  const auth = await resolveReplayAuth(c.req.raw);
  if (auth === null) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  const batch = parseUploadBody(await c.req.json());
  const db = openRequestSqlClient();

  await db.transaction(async (tx) => {
    await acquireUploadAdvisoryLock(tx, auth.actorId);
    await processUploadWithMutations({
      serverDb: asNestedTxClient(tx),
      registry: APP_MUTATIONS,
      auth,
      crud: batch.rows.map(uploadRowToCrud),
      transactionId: null,
      tablePolicyFor,
    });
  });

  return c.json({ ok: true }, 200);
}

/** PowerSync client upload endpoint (`POST /sync/upload`). */
export function createSyncRoutes() {
  return new Hono<ApiHonoEnv<AuthContext>>().post(
    '/sync/upload',
    handleSyncUpload
  );
}
