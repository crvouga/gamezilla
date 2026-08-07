import type { PubSub, Topic } from '@pkgs/pubsub/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { MutationUploadResult } from '../client/mutation-upload-queue';
import type { QueryRequest } from '../client/subscription-runtime';
import type { MutationEnv, MutationRegistry } from '../mutations/core/types';
import { processMutationsBatch } from '../mutations/server/process-mutations-batch';
import type { MutationRow } from '../mutations/server/replay-mutation';
import type {
  QueryRegistry,
  QueryResponse,
  QueryRow,
} from '../queries/core/types';
import { runQuery } from '../queries/server/run-query';
import { allocateTopicPushSeqs } from '../server/allocate-topic-push-seq';
import { notifyChannels } from '../server/notify-channels';
import {
  fanoutRowsWithinCap,
  mergeAffectedRows,
  selectFanoutRows,
} from '../shared/select-fanout-rows';

export type SimServerAuth = {
  readonly actorId: string;
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly isAnon: boolean;
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

/** Query-response checkpoint (scope merge). Distinct from per-topic pushSeq. */
function commitCheckpoint(nowMs: number, seq: number): string {
  return `${nowMs}${String(seq).padStart(6, '0')}`;
}

async function collectInvalidates(
  registry: MutationRegistry,
  env: MutationEnv,
  applied: readonly { name: string; argsJson: string }[],
  db: SqlClient
): Promise<Topic[]> {
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

function collectWrites(
  registry: MutationRegistry,
  applied: readonly { name: string }[]
): string[] {
  const tables = new Set<string>();
  for (const row of applied) {
    const mutation = registry[row.name];
    if (mutation === undefined) continue;
    for (const table of mutation.declaredWrites) tables.add(table);
  }
  return [...tables];
}

export type SimServerHandlerCtx = {
  readonly db: SqlClient;
  readonly now: () => number;
  readonly pubsub: PubSub;
  readonly resolveAuth: (clientId: string) => SimServerAuth;
  readonly mutations: MutationRegistry;
  readonly queries: QueryRegistry;
  readonly getAuth: () => SimServerAuth;
  readonly setAuth: (auth: SimServerAuth) => void;
  readonly nextCheckpoint: () => string;
  readonly rowImageFanout: boolean;
};

type MutationUploadRow = {
  readonly id: string;
  readonly name: string;
  readonly args: string;
  readonly clientId: string;
  readonly seq: number;
  readonly createdAt: string;
};

async function buildFanoutRows(
  ctx: SimServerHandlerCtx,
  auth: SimServerAuth,
  applied: readonly { name: string; argsJson: string }[]
): Promise<Record<string, QueryRow[]> | undefined> {
  if (!ctx.rowImageFanout) return undefined;
  const env: MutationEnv = {
    ...auth,
    now: () => new Date(ctx.now()),
  };
  const parts: Array<Readonly<Record<string, readonly string[]>>> = [];
  for (const row of applied) {
    const mutation = ctx.mutations[row.name];
    if (mutation?.affectedRows === undefined) continue;
    let args: unknown;
    try {
      args = mutation.args.parse(JSON.parse(row.argsJson));
    } catch {
      continue;
    }
    parts.push(mutation.affectedRows(args, env));
  }
  const affected = mergeAffectedRows(parts);
  if (Object.keys(affected).length === 0) return undefined;
  const rows = await selectFanoutRows(ctx.db, affected);
  if (Object.keys(rows).length === 0) return undefined;
  if (!fanoutRowsWithinCap(rows)) return undefined;
  return rows;
}

async function notifyApplied(args: {
  readonly ctx: SimServerHandlerCtx;
  readonly auth: SimServerAuth;
  readonly applied: readonly { name: string; argsJson: string }[];
}): Promise<ReadonlyMap<Topic, string>> {
  if (args.applied.length === 0) return new Map();
  const env: MutationEnv = {
    ...args.auth,
    now: () => new Date(args.ctx.now()),
  };
  const topics = await collectInvalidates(
    args.ctx.mutations,
    env,
    args.applied,
    args.ctx.db
  );
  const tables = collectWrites(args.ctx.mutations, args.applied);
  const rows = await buildFanoutRows(args.ctx, args.auth, args.applied);
  const checkpoints = await allocateTopicPushSeqs(args.ctx.db, topics);
  const label = args.applied.map((a) => a.name).join(',');
  for (const [topic, pushSeq] of checkpoints) {
    notifyChannels({
      pubsub: args.ctx.pubsub,
      topics: [topic],
      pushSeq,
      tables,
      ...(rows !== undefined ? { rows } : {}),
      label,
    });
  }
  return checkpoints;
}

/** Build mutations HTTP handler for the sim server. */
export function createHandleMutations(
  ctx: SimServerHandlerCtx
): (rows: readonly MutationUploadRow[]) => Promise<MutationUploadResult> {
  return async (rows) => {
    if (rows[0] !== undefined) {
      ctx.setAuth(ctx.resolveAuth(rows[0].clientId));
    }
    const stickyAuth = ctx.getAuth();
    const mutationRows: MutationRow[] = rows.map((m) => ({
      id: m.id,
      name: m.name,
      args: m.args,
      clientId: m.clientId,
      seq: m.seq,
      createdAt: m.createdAt,
    }));
    const result = await ctx.db.transaction(async (tx) =>
      processMutationsBatch({
        serverDb: asNestedTxClient(tx),
        registry: ctx.mutations,
        auth: stickyAuth,
        mutations: mutationRows,
        serverNow: () => new Date(ctx.now()),
      })
    );
    const checkpoints = await notifyApplied({
      ctx,
      auth: stickyAuth,
      applied: result.applied,
    });
    return {
      ok: true,
      verdicts: result.verdicts,
      ackSeq: result.ackSeq,
      ...(checkpoints.size > 0
        ? { topicPushSeqs: Object.fromEntries(checkpoints) }
        : {}),
    };
  };
}

/** Build query HTTP handler for the sim server. */
export function createHandleQuery(
  ctx: SimServerHandlerCtx
): (request: QueryRequest) => Promise<QueryResponse> {
  return (request) =>
    runQuery(
      {
        db: ctx.db,
        registry: ctx.queries,
        auth: {
          ...ctx.getAuth(),
          now: () => new Date(ctx.now()),
        },
        nextCheckpoint: ctx.nextCheckpoint,
      },
      {
        name: request.name,
        params: request.params,
        ...(request.lastHash !== undefined
          ? { lastHash: request.lastHash }
          : {}),
        ...(request.checkpoint !== undefined
          ? { checkpoint: request.checkpoint }
          : {}),
      }
    );
}

export { commitCheckpoint };
