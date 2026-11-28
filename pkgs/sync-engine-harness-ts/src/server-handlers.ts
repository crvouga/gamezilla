import type { PubSub } from '@pkgs/pubsub-root-shared-ts/interface';
import type { Topic } from '@pkgs/pubsub-root-shared-ts/topic';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type { MutationUploadResult } from '@pkgs/sync-engine-client-ts/mutation-upload-queue';
import type { QueryRequest } from '@pkgs/sync-engine-client-ts/subscription-runtime';
import { publishPushMessages } from '@pkgs/sync-engine-server-ts/notify-channels';
import { prepareMutationPush } from '@pkgs/sync-engine-server-ts/prepare-mutation-push';
import { processMutationsBatch } from '@pkgs/sync-engine-server-ts/process-mutations-batch';
import type { MutationRow } from '@pkgs/sync-engine-server-ts/replay-mutation';
import { runQuery } from '@pkgs/sync-engine-server-ts/run-query';
import type { MutationRegistry } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { QueryRegistry } from '@pkgs/sync-engine-shared-ts/queries-types';
import type { TopicMap } from '@pkgs/sync-engine-shared-ts/topic-map';
import type { QueryResponse } from '@pkgs/sync-engine-shared-ts/v2';
import type { WriteCaptureSnapshot } from '@pkgs/sync-engine-shared-ts/write-capture';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';
import type { HarnessHandleMutationsOpts } from './http-bridge-types';

export type HarnessServerAuth = {
  readonly actorId: string;
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly isAnon: boolean;
};

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

async function notifyApplied(args: {
  readonly ctx: HarnessServerHandlerCtx;
  readonly auth: HarnessServerAuth;
  readonly captures: readonly WriteCaptureSnapshot[];
  readonly label: string;
}): Promise<ReadonlyMap<Topic, string>> {
  if (args.captures.length === 0) return new Map();
  const push = await prepareMutationPush({
    db: args.ctx.db,
    auth: args.auth,
    captures: args.captures,
    topicMap: args.ctx.topicMap,
    rowImageFanout: args.ctx.rowImageFanout,
    now: args.ctx.now,
  });
  if (args.ctx.shouldFailPublish?.() !== true) {
    await publishPushMessages({
      ...push,
      pubsub: args.ctx.pubsub,
      checkpoint: args.ctx.nextCheckpoint(),
      label: args.label,
    });
  }
  return push.pushSeqs;
}

/** Build mutations HTTP handler for the harness server. */
export function createHandleMutations(
  ctx: HarnessServerHandlerCtx
): (
  rows: readonly MutationRow[],
  opts?: HarnessHandleMutationsOpts
) => Promise<MutationUploadResult> {
  return async (rows, opts) => {
    if (rows[0] !== undefined) {
      ctx.setAuth(ctx.resolveAuth(rows[0].clientId));
    }
    const stickyAuth = ctx.getAuth();
    const failAfter = opts?.failInsideTxnAfter;
    const result = await ctx.db.transaction(async (tx) =>
      processMutationsBatch({
        transaction: tx,
        registry: ctx.mutations,
        auth: stickyAuth,
        mutations: rows,
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
