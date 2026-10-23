import type { PubSub } from '@pkgs/pubsub-root-shared-ts/interface';
import type { Topic } from '@pkgs/pubsub-root-shared-ts/topic';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type { MutationUploadResult } from '@pkgs/sync-engine-client-ts/mutation-upload-queue';
import type { QueryRequest } from '@pkgs/sync-engine-client-ts/subscription-runtime';
import { allocateTopicPushSeqs } from '@pkgs/sync-engine-server-ts/allocate-topic-push-seq';
import { mutationSavepointClient } from '@pkgs/sync-engine-server-ts/mutation-savepoint-client';
import { publishPushMessages } from '@pkgs/sync-engine-server-ts/notify-channels';
import { processMutationsBatch } from '@pkgs/sync-engine-server-ts/process-mutations-batch';
import type { MutationRow } from '@pkgs/sync-engine-server-ts/replay-mutation';
import { runQuery } from '@pkgs/sync-engine-server-ts/run-query';
import type {
  MutationEnv,
  MutationRegistry,
} from '@pkgs/sync-engine-shared-ts/mutations-types';
import { partitionFanoutRowsByTopic } from '@pkgs/sync-engine-shared-ts/partition-fanout-rows';
import type { QueryRegistry } from '@pkgs/sync-engine-shared-ts/queries-types';
import { filterPublishableImages } from '@pkgs/sync-engine-shared-ts/row-image-guard';
import {
  fanoutRowsWithinCap,
  mergeAffectedRows,
  selectFanoutRows,
} from '@pkgs/sync-engine-shared-ts/select-fanout-rows';
import type { TopicMap } from '@pkgs/sync-engine-shared-ts/topic-map';
import {
  topicMapCtxFromEnv,
  topicsFromWriteCapture,
} from '@pkgs/sync-engine-shared-ts/topic-map';
import type { QueryResponse, QueryRow } from '@pkgs/sync-engine-shared-ts/v2';
import type { WriteCaptureSnapshot } from '@pkgs/sync-engine-shared-ts/write-capture';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';
import type { HarnessHandleMutationsOpts } from './http-bridge-types';

export type HarnessServerAuth = {
  readonly actorId: string;
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly isAnon: boolean;
};

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

export type HarnessServerHandlerCtx = {
  readonly db: SqlClient;
  readonly now: () => number;
  readonly createId: CreateId;
  readonly pubsub: PubSub;
  readonly resolveAuth: (clientId: string) => HarnessServerAuth;
  readonly mutations: MutationRegistry;
  readonly queries: QueryRegistry;
  readonly getAuth: () => HarnessServerAuth;
  readonly setAuth: (auth: HarnessServerAuth) => void;
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
  readonly originTraceparent: string | null;
  readonly correlation?: {
    readonly sessionId: string;
    readonly buildSha: string;
  };
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
  readonly ctx: HarnessServerHandlerCtx;
  readonly auth: HarnessServerAuth;
  readonly captures: readonly WriteCaptureSnapshot[];
  readonly label: string;
}): Promise<ReadonlyMap<Topic, string>> {
  if (args.captures.length === 0) return new Map();
  const env: MutationEnv = {
    ...args.auth,
    now: () => new Date(args.ctx.now()),
    createId: args.ctx.createId,
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
  const built = await buildFanoutRows(
    args.ctx.db,
    merged,
    args.ctx.rowImageFanout
  );
  // As production: a batch with rows that may not travel as images sends none.
  const rows =
    built === undefined ||
    filterPublishableImages(built, args.ctx.topicMap, mapCtx) !== built
      ? undefined
      : built;
  const rowsByTopic =
    rows !== undefined && args.ctx.topicMap !== undefined
      ? await partitionFanoutRowsByTopic({
          topicMap: args.ctx.topicMap,
          ctx: mapCtx,
          rows,
          db: args.ctx.db,
        })
      : undefined;
  const checkpoints = await allocateTopicPushSeqs(
    args.ctx.db,
    topics,
    args.ctx.now
  );
  if (args.ctx.shouldFailPublish?.() === true) {
    return checkpoints;
  }
  await publishPushMessages({
    pubsub: args.ctx.pubsub,
    pushSeqs: checkpoints,
    // After the replay commit — orders this push above any snapshot that was
    // read before it (see `PushMessage.checkpoint`).
    checkpoint: args.ctx.nextCheckpoint(),
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

/** Build mutations HTTP handler for the harness server. */
export function createHandleMutations(
  ctx: HarnessServerHandlerCtx
): (
  rows: readonly MutationUploadRow[],
  opts?: HarnessHandleMutationsOpts
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
      originTraceparent: m.originTraceparent,
      ...(m.correlation === undefined ? {} : { correlation: m.correlation }),
    }));
    const failAfter = opts?.failInsideTxnAfter;
    const result = await ctx.db.transaction(async (tx) =>
      processMutationsBatch({
        serverDb: mutationSavepointClient(tx),
        registry: ctx.mutations,
        auth: stickyAuth,
        mutations: mutationRows,
        now: ctx.now,
        createId: ctx.createId,
        ...(failAfter !== undefined
          ? {
              onAfterMutation: (index) => {
                if (index === failAfter) {
                  opts?.onArmed?.();
                  throw new Error('harness: fail inside mutations txn');
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
      serverTimeMs: ctx.now(),
      verdicts: [...result.verdicts],
      ackSeq: result.ackSeq,
      ...(checkpoints.size > 0
        ? { topicPushSeqs: Object.fromEntries(checkpoints) }
        : {}),
    };
  };
}

/** Build query HTTP handler for the harness server. */
export function createHandleQuery(
  ctx: HarnessServerHandlerCtx
): (request: QueryRequest, auth: HarnessServerAuth) => Promise<QueryResponse> {
  const now = (): Date => new Date(ctx.now());
  return (request, auth) =>
    runQuery(
      {
        db: ctx.db,
        registry: ctx.queries,
        auth: {
          ...auth,
          now,
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
