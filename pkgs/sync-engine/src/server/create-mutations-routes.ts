import type { PubSub, Topic } from '@pkgs/pubsub/interface';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { Hono } from 'hono';
import { z } from 'zod';

import type { MutationEnv, MutationRegistry } from '../mutations/core/types';
import { processMutationsBatch } from '../mutations/server/process-mutations-batch';
import type { MutationRow } from '../mutations/server/replay-mutation';
import type { AuthErrorBody } from '../queries/core/types';
import { MAX_MUTATIONS_BATCH } from '../queries/server/bounds';
import { isAuthErrorBody } from './auth-error';
import { notifyChannels } from './notify-channels';

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
  /** Optional nudge transport; omit to keep upload correct without pubsub. */
  readonly pubsub?: PubSub;
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

function commitCheckpoint(seq: number): string {
  return `${Date.now()}${String(seq).padStart(6, '0')}`;
}

function collectAppliedWrites(
  registry: MutationRegistry,
  applied: readonly { name: string }[]
): string[] {
  const tables = new Set<string>();
  for (const row of applied) {
    const mutation = registry[row.name];
    if (mutation === undefined) continue;
    for (const table of mutation.writes) tables.add(table);
  }
  return [...tables];
}

async function collectInvalidates(
  registry: MutationRegistry,
  auth: MutationsRouteAuth,
  applied: readonly { name: string; argsJson: string }[],
  db: SqlClient
): Promise<Topic[]> {
  const env: MutationEnv = {
    actorId: auth.actorId,
    deviceId: auth.deviceId,
    accountId: auth.accountId,
    isAnon: auth.isAnon,
    now: () => new Date(),
  };
  const topics: Topic[] = [];
  for (const row of applied) {
    const mutation = registry[row.name];
    if (mutation?.invalidates === undefined) continue;
    let args: unknown;
    try {
      args = mutation.args.parse(JSON.parse(row.argsJson));
    } catch {
      continue;
    }
    const next = await Promise.resolve(mutation.invalidates(args, env, db));
    topics.push(...next);
  }
  return topics;
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

    const pubsub = deps.pubsub;
    if (pubsub !== undefined && result.applied.length > 0) {
      const topics = await collectInvalidates(
        deps.registry,
        auth,
        result.applied,
        db
      );
      const tables = collectAppliedWrites(deps.registry, result.applied);
      notifyChannels({
        pubsub,
        topics,
        checkpoint: commitCheckpoint(result.ackSeq),
        tables,
        label: result.applied.map((a) => a.name).join(','),
      });
    }

    return c.json(
      { ok: result.ok, verdicts: result.verdicts, ackSeq: result.ackSeq },
      200
    );
  });
}
