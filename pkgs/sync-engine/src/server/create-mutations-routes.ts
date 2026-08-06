import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { Hono } from 'hono';
import { z } from 'zod';

import type { MutationRegistry } from '../mutations/core/types';
import { processMutationsBatch } from '../mutations/server/process-mutations-batch';
import type { MutationRow } from '../mutations/server/replay-mutation';
import type { AuthErrorBody } from '../queries/core/types';
import { MAX_MUTATIONS_BATCH } from '../queries/server/bounds';
import { isAuthErrorBody } from './auth-error';

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

export type MutationsRouteAuth = {
  readonly actorId: string;
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly isAnon: boolean;
};

export type CreateMutationsRoutesDeps = {
  readonly resolveAuth: (
    request: Request
  ) => Promise<MutationsRouteAuth | AuthErrorBody>;
  readonly getSql: () => SqlClient;
  readonly registry: MutationRegistry;
};

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

/** `POST /mutations` — ordered mutation log replay with verdicts. */
export function createMutationsRoutes(deps: CreateMutationsRoutesDeps) {
  return new Hono().post('/mutations', async (c) => {
    const auth = await deps.resolveAuth(c.req.raw);
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
    const db = deps.getSql();
    const result = await db.transaction(async (tx) => {
      await acquireLock(tx, auth.actorId);
      return processMutationsBatch({
        serverDb: asNestedTxClient(tx),
        registry: deps.registry,
        auth,
        mutations,
      });
    });
    return c.json(result, 200);
  });
}
