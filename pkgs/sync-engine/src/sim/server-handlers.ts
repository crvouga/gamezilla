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
import { publishPushMessages } from '../server/notify-channels';
import { partitionFanoutRowsByTopic } from '../shared/partition-fanout-rows';
import {
  fanoutRowsWithinCap,
  mergeAffectedRows,
  selectFanoutRows,
} from '../shared/select-fanout-rows';
import {
  type TopicMap,
  topicMapCtxFromEnv,
  topicsFromWriteCapture,
} from '../shared/topic-map';
import type { WriteCaptureSnapshot } from '../sql-ast';
import type { SimHandleMutationsOpts } from './http-bridge-types';

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

function mergeCaptures(
  captures: readonly WriteCaptureSnapshot[]
): WriteCaptureSnapshot {
  const tableSet = new Set<string>();
  const idParts: Array<Readonly<Record<string, readonly string[]>>> = [];
  const imageParts: Record<string, QueryRow[]> = {};
  for (const c of captures) {
    for (const t of c.tables) tableSet.add(t);
    idParts.push(c.ids);
    for (const [table, rows] of Object.entries(c.images)) {
      const byId = new Map(
        (imageParts[table] ?? []).map(
          (r) => [String(r['id'] ?? ''), r] as const
        )
      );
      for (const row of rows) {
        const id = String(row['id'] ?? '');
        if (id.length === 0) continue;
        byId.set(id, { ...row });
      }
      imageParts[table] = [...byId.values()];
    }
  }
  return {
    tables: [...tableSet].sort(),
    ids: mergeAffectedRows(idParts),
    images: imageParts,
  };
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
  readonly topicMap?: TopicMap;
  /** When true, skip notifyChannels after a successful replay commit. */
  readonly shouldFailPublish?: () => boolean;
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
  db: SqlClient,
  capture: WriteCaptureSnapshot,
  rowImageFanout: boolean
): Promise<Record<string, QueryRow[]> | undefined> {
  if (!rowImageFanout) return undefined;
  if (Object.keys(capture.images).length > 0) {
    if (!fanoutRowsWithinCap(capture.images)) return undefined;
    const copy: Record<string, QueryRow[]> = {};
    for (const [table, rows] of Object.entries(capture.images)) {
      copy[table] = rows.map((r) => ({ ...r }));
    }
    return copy;
  }
  if (Object.keys(capture.ids).length === 0) return undefined;
  const rows = await selectFanoutRows(db, capture.ids);
  if (Object.keys(rows).length === 0) return undefined;
  if (!fanoutRowsWithinCap(rows)) return undefined;
  return rows;
}

async function notifyApplied(args: {
  readonly ctx: SimServerHandlerCtx;
  readonly auth: SimServerAuth;
  readonly captures: readonly WriteCaptureSnapshot[];
  readonly label: string;
}): Promise<ReadonlyMap<Topic, string>> {
  if (args.captures.length === 0) return new Map();
  const env: MutationEnv = {
    ...args.auth,
    now: () => new Date(args.ctx.now()),
  };
  const merged = mergeCaptures(args.captures);
  const mapCtx = topicMapCtxFromEnv(env);
  const topics =
    args.ctx.topicMap === undefined
      ? []
      : await topicsFromWriteCapture({
          topicMap: args.ctx.topicMap,
          capture: merged,
          ctx: mapCtx,
          db: args.ctx.db,
        });
  const rows = await buildFanoutRows(
    args.ctx.db,
    merged,
    args.ctx.rowImageFanout
  );
  const rowsByTopic =
    rows !== undefined && args.ctx.topicMap !== undefined
      ? await partitionFanoutRowsByTopic({
          topicMap: args.ctx.topicMap,
          ctx: mapCtx,
          rows,
          db: args.ctx.db,
        })
      : undefined;
  const checkpoints = await allocateTopicPushSeqs(args.ctx.db, topics);
  if (args.ctx.shouldFailPublish?.() === true) {
    return checkpoints;
  }
  publishPushMessages({
    pubsub: args.ctx.pubsub,
    pushSeqs: checkpoints,
    tables: merged.tables,
    ...(rowsByTopic !== undefined
      ? { rowsByTopic }
      : rows !== undefined
        ? { rows }
        : {}),
    label: args.label,
  });
  return checkpoints;
}

/** Build mutations HTTP handler for the sim server. */
export function createHandleMutations(
  ctx: SimServerHandlerCtx
): (
  rows: readonly MutationUploadRow[],
  opts?: SimHandleMutationsOpts
) => Promise<MutationUploadResult> {
  return async (rows, opts) => {
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
    const failAfter = opts?.failInsideTxnAfter;
    const result = await ctx.db.transaction(async (tx) =>
      processMutationsBatch({
        serverDb: asNestedTxClient(tx),
        registry: ctx.mutations,
        auth: stickyAuth,
        mutations: mutationRows,
        serverNow: () => new Date(ctx.now()),
        ...(failAfter !== undefined
          ? {
              onAfterMutation: (index) => {
                if (index === failAfter) {
                  opts?.onArmed?.();
                  throw new Error('sim: fail inside mutations txn');
                }
              },
            }
          : {}),
      })
    );
    const captures = result.applied.map((a) => a.capture);
    const checkpoints = await notifyApplied({
      ctx,
      auth: stickyAuth,
      captures,
      label: result.applied.map((a) => a.name).join(','),
    });
    return {
      ok: true as const,
      verdicts: [...result.verdicts],
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
        strictQueryLimits: true,
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

/** Query-response checkpoint (scope merge). Distinct from per-topic pushSeq. */
export function commitCheckpoint(nowMs: number, seq: number): string {
  return `${nowMs}${String(seq).padStart(6, '0')}`;
}
