import type { PubSub, Topic } from '@pkgs/pubsub/interface';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { Hono } from 'hono';
import { z } from 'zod';

import type { MutationEnv, MutationRegistry } from '../mutations/core/types';
import { processMutationsBatch } from '../mutations/server/process-mutations-batch';
import type { MutationRow } from '../mutations/server/replay-mutation';
import type { AuthErrorBody, QueryRow } from '../queries/core/types';
import { MAX_MUTATIONS_BATCH } from '../queries/shared/bounds';
import { allocateTopicCheckpoints } from './allocate-topic-checkpoint';
import { isAuthErrorBody } from './auth-error';
import { notifyChannels } from './notify-channels';
import {
  fanoutRowsWithinCap,
  mergeAffectedRows,
  selectFanoutRows,
} from './select-fanout-rows';
import type { SyncAppAuth } from './sync-app-auth';

const mutationRowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  args: z.string(),
  clientId: z.string().min(1),
  seq: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
});

const mutationsBodySchema = z.object({
  mutations: z.array(mutationRowSchema).max(MAX_MUTATIONS_BATCH),
});

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

function collectAppliedWrites(
  mutationRegistry: MutationRegistry,
  applied: readonly { name: string }[]
): string[] {
  const tables = new Set<string>();
  for (const row of applied) {
    const mutation = mutationRegistry[row.name];
    if (mutation === undefined) continue;
    for (const table of mutation.writes) tables.add(table);
  }
  return [...tables];
}

async function collectInvalidates(
  mutationRegistry: MutationRegistry,
  auth: SyncAppAuth,
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
  const seen = new Set<Topic>();
  const topics: Topic[] = [];
  for (const row of applied) {
    const mutation = mutationRegistry[row.name];
    if (mutation?.invalidates === undefined) continue;
    let args: unknown;
    try {
      args = mutation.args.parse(JSON.parse(row.argsJson));
    } catch {
      continue;
    }
    const next = await Promise.resolve(mutation.invalidates(args, env, db));
    for (const topic of next) {
      if (seen.has(topic)) continue;
      seen.add(topic);
      topics.push(topic);
    }
  }
  return topics;
}

function collectAffectedRowMaps(
  mutationRegistry: MutationRegistry,
  auth: SyncAppAuth,
  applied: readonly { name: string; argsJson: string }[]
): Record<string, string[]> {
  const env: MutationEnv = {
    actorId: auth.actorId,
    deviceId: auth.deviceId,
    accountId: auth.accountId,
    isAnon: auth.isAnon,
    now: () => new Date(),
  };
  const parts: Array<Readonly<Record<string, readonly string[]>>> = [];
  for (const row of applied) {
    const mutation = mutationRegistry[row.name];
    if (mutation?.affectedRows === undefined) continue;
    let args: unknown;
    try {
      args = mutation.args.parse(JSON.parse(row.argsJson));
    } catch {
      continue;
    }
    parts.push(mutation.affectedRows(args, env));
  }
  return mergeAffectedRows(parts);
}

async function buildFanoutRows(args: {
  readonly db: SqlClient;
  readonly mutationRegistry: MutationRegistry;
  readonly auth: SyncAppAuth;
  readonly applied: readonly { name: string; argsJson: string }[];
  readonly rowImageFanout: boolean;
}): Promise<Record<string, QueryRow[]> | undefined> {
  if (!args.rowImageFanout) return undefined;
  const affected = collectAffectedRowMaps(
    args.mutationRegistry,
    args.auth,
    args.applied
  );
  if (Object.keys(affected).length === 0) return undefined;
  const rows = await selectFanoutRows(args.db, affected);
  if (Object.keys(rows).length === 0) return undefined;
  if (!fanoutRowsWithinCap(rows)) return undefined;
  return rows;
}

type PreparedMutationNotify = {
  readonly result: Awaited<ReturnType<typeof processMutationsBatch>>;
  readonly tables: readonly string[];
  readonly rows: Record<string, QueryRow[]> | undefined;
  readonly checkpoints: ReadonlyMap<Topic, string>;
};

async function prepareMutationNotify(
  deps: MountMutationsRouteDeps,
  auth: SyncAppAuth,
  mutationRows: MutationRow[]
): Promise<PreparedMutationNotify> {
  const db = deps.getSql();
  // Replay + fanout SELECT + checkpoint allocate share one transaction so
  // remote Postgres pays one connection RTT chain instead of post-commit
  // round-trips (was dominating peer-visible latency).
  return db.transaction(async (tx) => {
    await acquireLock(tx, auth.actorId);
    const nested = asNestedTxClient(tx);
    const result = await processMutationsBatch({
      serverDb: nested,
      registry: deps.mutations,
      auth,
      mutations: mutationRows,
    });
    if (result.applied.length === 0 || deps.pubsub === undefined) {
      return {
        result,
        tables: [] as string[],
        rows: undefined,
        checkpoints: new Map<Topic, string>(),
      };
    }
    const topics = await collectInvalidates(
      deps.mutations,
      auth,
      result.applied,
      nested
    );
    const tables = collectAppliedWrites(deps.mutations, result.applied);
    const rows = await buildFanoutRows({
      db: nested,
      mutationRegistry: deps.mutations,
      auth,
      applied: result.applied,
      rowImageFanout: deps.rowImageFanout === true,
    });
    const checkpoints = await allocateTopicCheckpoints(nested, topics);
    return { result, tables, rows, checkpoints };
  });
}

function publishMutationNudges(
  deps: MountMutationsRouteDeps,
  prepared: PreparedMutationNotify
): void {
  if (deps.pubsub === undefined || prepared.result.applied.length === 0) return;
  const label = prepared.result.applied.map((a) => a.name).join(',');
  for (const [topic, checkpoint] of prepared.checkpoints) {
    notifyChannels({
      pubsub: deps.pubsub,
      topics: [topic],
      checkpoint,
      tables: prepared.tables,
      ...(prepared.rows !== undefined ? { rows: prepared.rows } : {}),
      label,
    });
  }
}

export type MountMutationsRouteDeps = {
  readonly resolveAuth: (
    request: Request
  ) => Promise<SyncAppAuth | AuthErrorBody>;
  readonly getSql: () => SqlClient;
  readonly mutations: MutationRegistry;
  readonly pubsub?: PubSub;
  /** When true, publish post-replay row images on nudges (default false). */
  readonly rowImageFanout?: boolean;
};

export function mountMutationsRoute(
  app: Hono,
  deps: MountMutationsRouteDeps
): void {
  app.post('/mutations', async (c) => {
    const auth = await deps.resolveAuth(c.req.raw);
    if (isAuthErrorBody(auth)) {
      return c.json(auth, 401);
    }
    const parsed = mutationsBodySchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: 'invalid_batch' }, 400);
    }
    if (parsed.data.mutations.length > MAX_MUTATIONS_BATCH) {
      return c.json({ error: 'batch_too_large' }, 413);
    }
    const mutationRows: MutationRow[] = parsed.data.mutations.map((m) => ({
      id: m.id,
      name: m.name,
      args: m.args,
      clientId: m.clientId,
      seq: m.seq,
      createdAt: m.createdAt,
    }));
    const prepared = await prepareMutationNotify(deps, auth, mutationRows);
    const { result, checkpoints } = prepared;
    if (deps.pubsub !== undefined && result.applied.length > 0) {
      publishMutationNudges(deps, prepared);
      return c.json(
        {
          ok: result.ok,
          verdicts: result.verdicts,
          ackSeq: result.ackSeq,
          topicCheckpoints: Object.fromEntries(checkpoints),
        },
        200
      );
    }
    return c.json(
      { ok: result.ok, verdicts: result.verdicts, ackSeq: result.ackSeq },
      200
    );
  });
}
