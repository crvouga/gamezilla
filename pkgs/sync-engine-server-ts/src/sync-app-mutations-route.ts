import { bindIdentity } from '@pkgs/observability-root-shared-ts/identity-scope';
import type { PubSub } from '@pkgs/pubsub-root-shared-ts/interface';
import type { Topic } from '@pkgs/pubsub-root-shared-ts/topic';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type {
  ContentRules,
  MutationAuthorize,
  MutationEnv,
  MutationRegistry,
} from '@pkgs/sync-engine-shared-ts/mutations-types';
import { partitionFanoutRowsByTopic } from '@pkgs/sync-engine-shared-ts/partition-fanout-rows';
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
import type { AuthErrorBody, QueryRow } from '@pkgs/sync-engine-shared-ts/v2';
import {
  MAX_MUTATIONS_BATCH,
  MAX_MUTATIONS_BODY_BYTES,
  SYNC_PROTOCOL_VERSION,
} from '@pkgs/sync-engine-shared-ts/v2';
import type { WriteCaptureSnapshot } from '@pkgs/sync-engine-shared-ts/write-capture';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';
import type { Hono } from 'hono';
import { allocateTopicPushSeqs } from './allocate-topic-push-seq';
import { isAuthErrorBody } from './auth-error';
import { syncBodyCap } from './body-cap';
import { mutationSavepointClient } from './mutation-savepoint-client';
import { publishPushMessages } from './notify-channels';
import { parseMutationsBatchBody } from './parse-batch-body';
import { processMutationsBatch } from './process-mutations-batch';
import type { MutationRow } from './replay-mutation';
import type { SyncSqlVariables } from './resolve-request-sql';
import { resolveRequestSql } from './resolve-request-sql';
import type { SyncAppAuth } from './sync-app-auth';
import { assertSyncProtocol } from './sync-protocol-gate';

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
        // Later captures win (batch order) so last write's post-image is published.
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

async function collectTopicsFromCaptures(args: {
  readonly topicMap: TopicMap | undefined;
  readonly auth: SyncAppAuth;
  readonly captures: readonly WriteCaptureSnapshot[];
  readonly db: SqlClient;
  readonly now: () => number;
  readonly createId: () => string;
}): Promise<Topic[]> {
  if (args.topicMap === undefined || args.captures.length === 0) return [];
  const env: MutationEnv = {
    actorId: args.auth.actorId,
    deviceId: args.auth.deviceId,
    accountId: args.auth.accountId,
    isAnon: args.auth.isAnon,
    now: () => new Date(args.now()),
    createId: args.createId,
  };
  const merged = mergeCaptures(args.captures);
  return topicsFromWriteCapture({
    topicMap: args.topicMap,
    capture: merged,
    ctx: topicMapCtxFromEnv(env),
    db: args.db,
  });
}

async function buildFanoutRows(args: {
  readonly db: SqlClient;
  readonly capture: WriteCaptureSnapshot;
  readonly rowImageFanout: boolean;
}): Promise<Record<string, QueryRow[]> | undefined> {
  if (!args.rowImageFanout) return undefined;
  // Prefer RETURNING images; fall back to SELECT for id-only tables.
  const fromCapture = args.capture.images;
  if (Object.keys(fromCapture).length > 0) {
    if (!fanoutRowsWithinCap(fromCapture)) return undefined;
    const copy: Record<string, QueryRow[]> = {};
    for (const [table, rows] of Object.entries(fromCapture)) {
      copy[table] = rows.map((r) => ({ ...r }));
    }
    return copy;
  }
  if (Object.keys(args.capture.ids).length === 0) return undefined;
  const rows = await selectFanoutRows(args.db, args.capture.ids);
  if (Object.keys(rows).length === 0) return undefined;
  if (!fanoutRowsWithinCap(rows)) return undefined;
  return rows;
}

type PreparedMutationNotify = {
  readonly result: Awaited<ReturnType<typeof processMutationsBatch>>;
  readonly tables: readonly string[];
  readonly rows: Record<string, QueryRow[]> | undefined;
  readonly rowsByTopic:
    | ReadonlyMap<Topic, Record<string, QueryRow[]>>
    | undefined;
  readonly checkpoints: ReadonlyMap<Topic, string>;
};

async function prepareMutationNotify(
  deps: MountMutationsRouteDeps,
  auth: SyncAppAuth,
  mutationRows: MutationRow[],
  db: SqlClient
): Promise<PreparedMutationNotify> {
  return db.transaction(async (tx) => {
    const nested = mutationSavepointClient(tx);
    const result = await processMutationsBatch({
      serverDb: nested,
      registry: deps.mutations,
      auth,
      mutations: mutationRows,
      now: deps.now,
      createId: deps.createId,
      ...(deps.authorize !== undefined ? { authorize: deps.authorize } : {}),
      ...(deps.turnGames === undefined ? {} : { turnGames: deps.turnGames }),
      ...(deps.contentRulesAt !== undefined
        ? { contentRulesAt: deps.contentRulesAt }
        : {}),
    });
    if (result.applied.length === 0 || deps.pubsub === undefined) {
      return {
        result,
        tables: [] as string[],
        rows: undefined,
        rowsByTopic: undefined,
        checkpoints: new Map<Topic, string>(),
      };
    }
    const captures = result.applied.map((a) => a.capture);
    const merged = mergeCaptures(captures);
    const env: MutationEnv = {
      actorId: auth.actorId,
      deviceId: auth.deviceId,
      accountId: auth.accountId,
      isAnon: auth.isAnon,
      now: () => new Date(deps.now()),
      createId: deps.createId,
    };
    const topics = await collectTopicsFromCaptures({
      topicMap: deps.topicMap,
      auth,
      captures,
      db: nested,
      now: deps.now,
      createId: deps.createId,
    });
    const tables = merged.tables;
    // A batch writing rows that may not travel as images (`rowImage.publish`)
    // sends none at all: every reader is woken and reads again through its
    // own authorized queries, so no such row ever leaves in a push.
    const built = await buildFanoutRows({
      db: nested,
      capture: merged,
      rowImageFanout: deps.rowImageFanout === true,
    });
    const rows =
      built === undefined ||
      filterPublishableImages(built, deps.topicMap, topicMapCtxFromEnv(env)) !==
        built
        ? undefined
        : built;
    const rowsByTopic =
      rows !== undefined && deps.topicMap !== undefined
        ? await partitionFanoutRowsByTopic({
            topicMap: deps.topicMap,
            ctx: topicMapCtxFromEnv(env),
            rows,
            db: nested,
          })
        : undefined;
    const checkpoints = await allocateTopicPushSeqs(nested, topics, deps.now);
    return { result, tables, rows, rowsByTopic, checkpoints };
  });
}

async function publishMutationPushes(
  deps: MountMutationsRouteDeps,
  prepared: PreparedMutationNotify
): Promise<void> {
  if (deps.pubsub === undefined || prepared.result.applied.length === 0) return;
  const label = prepared.result.applied.map((a) => a.name).join(',');
  await publishPushMessages({
    pubsub: deps.pubsub,
    pushSeqs: prepared.checkpoints,
    // Minted after the replay transaction committed: any snapshot read before
    // the commit carries a lower checkpoint and is rejected once a client has
    // applied these rows.
    checkpoint: deps.nextCheckpoint(),
    tables: prepared.tables,
    ...(prepared.rowsByTopic !== undefined
      ? { rowsByTopic: prepared.rowsByTopic }
      : prepared.rows !== undefined
        ? { rows: prepared.rows }
        : {}),
    label,
  });
}

export type MountMutationsRouteDeps = {
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
    const mutationRows: MutationRow[] = parsed.mutations.map((m) => ({
      id: m.id,
      name: m.name,
      args: m.args,
      clientId: m.clientId,
      seq: m.seq,
      createdAt: m.createdAt,
      originTraceparent: m.originTraceparent,
      ...(m.correlation === undefined ? {} : { correlation: m.correlation }),
    }));
    const prepared = await prepareMutationNotify(deps, auth, mutationRows, db);
    const { result, checkpoints } = prepared;
    if (deps.pubsub !== undefined && result.applied.length > 0) {
      await publishMutationPushes(deps, prepared);
    }
    if (result.applied.length > 0)
      await deps.onCommitted?.(result.applied.map((item) => item.capture));
    return c.json(
      {
        ok: result.ok,
        serverTimeMs: deps.now(),
        verdicts: result.verdicts,
        ackSeq: result.ackSeq,
        ...(deps.pubsub !== undefined && result.applied.length > 0
          ? { topicPushSeqs: Object.fromEntries(checkpoints) }
          : {}),
        protocol: SYNC_PROTOCOL_VERSION,
      },
      200
    );
  });
}
