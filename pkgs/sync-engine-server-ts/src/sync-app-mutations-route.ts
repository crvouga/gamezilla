import { bindIdentity } from '@pkgs/observability-root-shared-ts/identity-scope';
import type { PubSub } from '@pkgs/pubsub-root-shared-ts/interface';
import type { RoomServicePort } from '@pkgs/room-root-shared-ts/room-service';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type {
  ContentRules,
  MutationAuthorize,
  MutationRegistry,
} from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { TopicMap } from '@pkgs/sync-engine-shared-ts/topic-map';
import type { AuthErrorBody } from '@pkgs/sync-engine-shared-ts/v2';
import {
  MAX_MUTATIONS_BATCH,
  MAX_MUTATIONS_BODY_BYTES,
  SYNC_PROTOCOL_VERSION,
} from '@pkgs/sync-engine-shared-ts/v2';
import type { WriteCaptureSnapshot } from '@pkgs/sync-engine-shared-ts/write-capture';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';
import type { Hono } from 'hono';
import { isAuthErrorBody } from './auth-error';
import { syncBodyCap } from './body-cap';
import { countMutationReplays } from './count-mutation-replays';
import type { MutationLifecycle } from './mutation-lifecycle';
import { publishPushMessages } from './notify-channels';
import { parseMutationsBatchBody } from './parse-batch-body';
import { prepareMutationPush } from './prepare-mutation-push';
import { processMutationsBatch } from './process-mutations-batch';
import type { MutationRow } from './replay-mutation';
import type { SyncSqlVariables } from './resolve-request-sql';
import { resolveRequestSql } from './resolve-request-sql';
import { retryMutationTransaction } from './retry-mutation-transaction';
import type { SyncAppAuth } from './sync-app-auth';
import { assertSyncProtocol } from './sync-protocol-gate';

async function prepareMutationNotify(
  deps: MountMutationsRouteDeps,
  auth: SyncAppAuth,
  mutationRows: readonly MutationRow[],
  db: SqlClient
) {
  return countMutationReplays(mutationRows.length, () =>
    retryMutationTransaction(db, (tx) =>
      prepareMutationNotifyIn(deps, auth, mutationRows, tx)
    )
  );
}

async function prepareMutationNotifyIn(
  deps: MountMutationsRouteDeps,
  auth: SyncAppAuth,
  mutationRows: readonly MutationRow[],
  tx: SqlClient
) {
  const result = await processMutationsBatch({
    transaction: tx,
    registry: deps.mutations,
    auth,
    mutations: mutationRows,
    now: deps.now,
    createId: deps.createId,
    ...(deps.authorize !== undefined ? { authorize: deps.authorize } : {}),
    ...(deps.wrapMutationTx === undefined
      ? {}
      : { wrapMutationTx: deps.wrapMutationTx }),
    ...(deps.turnGames === undefined ? {} : { turnGames: deps.turnGames }),
    ...(deps.rooms === undefined ? {} : { rooms: deps.rooms }),
    ...(deps.contentRulesAt !== undefined
      ? { contentRulesAt: deps.contentRulesAt }
      : {}),
  });
  const push =
    deps.pubsub === undefined || result.applied.length === 0
      ? undefined
      : await prepareMutationPush({
          db: tx,
          auth,
          captures: result.applied.map((applied) => applied.capture),
          topicMap: deps.topicMap,
          rowImageFanout: deps.rowImageFanout === true,
          now: deps.now,
        });
  return { result, push };
}

export type MountMutationsRouteDeps = MutationLifecycle & {
  readonly resolveAuth: (
    request: Request
  ) => Promise<SyncAppAuth | AuthErrorBody>;
  readonly getSql: () => SqlClient;
  readonly mutations: MutationRegistry;
  readonly now: () => number;
  readonly createId: CreateId;
  /** Shared with the query routes — snapshot / push ordering must agree. */
  readonly nextCheckpoint: () => string;
  readonly pubsub?: PubSub;
  /** When true, publish post-replay row images on pushes (default false). */
  readonly rowImageFanout?: boolean;
  readonly topicMap?: TopicMap;
  readonly authorize?: MutationAuthorize;
  /**
   * The app's content rules as they stood at a write's time (its
   * `created_at`), handed to the mutation body as `env.contentRules`.
   */
  readonly turnGames?: TurnGames;
  readonly rooms?: RoomServicePort;
  readonly contentRulesAt?: (atMs: number) => ContentRules;
  readonly onCommitted?: (
    captures: readonly WriteCaptureSnapshot[]
  ) => Promise<void>;
};

export function mountMutationsRoute(
  app: Hono<{ Variables: SyncSqlVariables }>,
  deps: MountMutationsRouteDeps
): void {
  app.post('/mutations', syncBodyCap(MAX_MUTATIONS_BODY_BYTES), async (c) => {
    const db = resolveRequestSql(c, deps.getSql);
    const protocolErr = assertSyncProtocol(c.req.raw);
    if (protocolErr !== null) return c.json(protocolErr, 401);
    const auth = await deps.resolveAuth(c.req.raw);
    if (isAuthErrorBody(auth)) {
      return c.json(auth, 401);
    }
    bindIdentity({
      userId: auth.accountId ?? auth.actorId,
      deviceId: auth.deviceId,
    });
    const parsed = parseMutationsBatchBody(await c.req.json());
    if (parsed === null) {
      return c.json({ error: 'invalid_batch' }, 400);
    }
    if (parsed.mutations.length > MAX_MUTATIONS_BATCH) {
      return c.json({ error: 'batch_too_large' }, 413);
    }
    const { result, push } = await prepareMutationNotify(
      deps,
      auth,
      parsed.mutations,
      db
    );
    if (deps.pubsub !== undefined && push !== undefined) {
      await publishPushMessages({
        ...push,
        pubsub: deps.pubsub,
        // A checkpoint minted after commit orders this push above earlier snapshots.
        checkpoint: deps.nextCheckpoint(),
        label: result.applied.map((applied) => applied.name).join(','),
      });
    }
    if (result.applied.length > 0)
      await deps.onCommitted?.(result.applied.map((item) => item.capture));
    await deps.onCommittedMutations?.({
      db,
      auth,
      mutationIds: result.verdicts
        .filter((verdict) => verdict.status === 'applied')
        .map((verdict) => verdict.mutationId),
    });
    return c.json(
      {
        ok: result.ok,
        serverTimeMs: deps.now(),
        verdicts: result.verdicts,
        ackSeq: result.ackSeq,
        ...(push !== undefined
          ? { topicPushSeqs: Object.fromEntries(push.pushSeqs) }
          : {}),
        protocol: SYNC_PROTOCOL_VERSION,
      },
      200
    );
  });
}
