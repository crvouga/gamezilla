import { assert } from '@pkgs/assert';
import { MAX_MUTATIONS_BATCH } from '@pkgs/queries/server/bounds';
import { processMutationsBatch } from '@pkgs/mutations/server/process-mutations-batch';
import type { MutationRow } from '@pkgs/mutations/server/replay-mutation';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AuthContext } from '@libs/auth/server/types';
import type { ApiHonoEnv } from '../app/api-hono-types';
import { apiRequestAsyncLocalStorage } from '../request-scope';
import { APP_MUTATIONS } from './app-mutations';
import { isAuthErrorBody, resolveSessionReplayAuth } from './query-auth';

const mutationRowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  args: z.string(),
  clientId: z.string().min(1),
  seq: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
});

const bodySchema = z.object({
  mutations: z.array(mutationRowSchema).max(MAX_MUTATIONS_BATCH),
});

function openRequestSqlClient(): SqlClient {
  const requestStore = apiRequestAsyncLocalStorage.getStore();
  assert.defined(requestStore, 'mutations sql: request store missing');
  return requestStore.sqlClient;
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

async function acquireLock(tx: SqlClient, lockUserId: string): Promise<void> {
  try {
    await tx.run(
      sql<void>`SELECT pg_advisory_xact_lock(hashtext(${lockUserId}))`
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (
      message.includes('no such function') ||
      message.includes('pg_advisory_xact_lock')
    ) {
      return;
    }
    throw e;
  }
}

async function handleMutations(
  c: Context<ApiHonoEnv<AuthContext>>
): Promise<Response> {
  const auth = await resolveSessionReplayAuth(c.req.raw);
  if (isAuthErrorBody(auth)) {
    return c.json(auth, 401);
  }
  const parsed = bodySchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'invalid_batch' }, 400);
  }
  if (parsed.data.mutations.length > MAX_MUTATIONS_BATCH) {
    return c.json({ error: 'batch_too_large' }, 413);
  }
  const mutations: MutationRow[] = parsed.data.mutations.map((m) => ({
    id: m.id,
    name: m.name,
    args: m.args,
    clientId: m.clientId,
    seq: m.seq,
    createdAt: m.createdAt,
  }));
  const db = openRequestSqlClient();
  const result = await db.transaction(async (tx) => {
    await acquireLock(tx, auth.actorId);
    return processMutationsBatch({
      serverDb: asNestedTxClient(tx),
      registry: APP_MUTATIONS,
      auth,
      mutations,
    });
  });
  return c.json(result, 200);
}

/** `POST /api/mutations` — ordered mutation log replay with verdicts. */
export function createMutationsRoutes() {
  return new Hono<ApiHonoEnv<AuthContext>>().post('/mutations', (c) =>
    handleMutations(c)
  );
}
