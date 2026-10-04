import type { PubSub } from '@pkgs/pubsub-shared/interface';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import type { LocalDomainSchema } from '@pkgs/sync-engine-client/local-schema-migrate';
import { notifyChannels } from '@pkgs/sync-engine-server/notify-channels';
import { pruneMutationArtifacts } from '@pkgs/sync-engine-server/prune-mutation-artifacts';
import type { MonotonicCheckpoint } from '@pkgs/sync-engine-shared/commit-checkpoint';
import { createMonotonicCheckpoint } from '@pkgs/sync-engine-shared/commit-checkpoint';
import { withFrameworkTopicMap } from '@pkgs/sync-engine-shared/framework-topic-map';
import type { MutationRegistry } from '@pkgs/sync-engine-shared/mutations-types';
import type { QueryRegistry } from '@pkgs/sync-engine-shared/queries-types';
import type { TopicMap } from '@pkgs/sync-engine-shared/topic-map';
import { withFrameworkMutations } from '@pkgs/sync-engine-shared/with-framework-mutations';
import type { CreateId } from '@pkgs/uuid-shared/create-id';
import type { EdgeFaultController } from './edge-faults';
import type { HarnessHttpServerHandlers } from './http-bridge-types';
import { openHarnessSqliteServer } from './open-harness-sqlite';
import type {
  HarnessServerAuth,
  HarnessServerHandlerCtx,
} from './server-handlers';
import { createHandleMutations, createHandleQuery } from './server-handlers';

export type HarnessServer = {
  readonly db: SqlClient;
  readonly handlers: HarnessHttpServerHandlers;
  readonly setAuth: (auth: HarnessServerAuth) => void;
  readonly pruneArtifacts: (olderThanMs: number) => Promise<void>;
  /**
   * Domain-agnostic fanout after an out-of-band server write.
   * Allocates push seqs and publishes on the given topics.
   */
  readonly notifyFanout: (args: {
    readonly topics: readonly string[];
    readonly tables: readonly string[];
    readonly label: string;
  }) => Promise<void>;
  /** Highest query checkpoint issued by this process (for remake floor). */
  readonly checkpointHighWater: () => bigint;
  readonly dispose: () => Promise<void>;
};

export type OpenHarnessServerArgs = {
  readonly now: () => number;
  readonly createId: CreateId;
  readonly pubsub: PubSub;
  readonly resolveAuth: (clientId: string) => HarnessServerAuth;
  readonly mutationRegistry: MutationRegistry;
  readonly queryRegistry: QueryRegistry;
  readonly localSchema: LocalDomainSchema;
  readonly rowImageFanout?: boolean;
  readonly faults?: EdgeFaultController;
  readonly topicMap?: TopicMap;
  /** Shared across simulated nodes behind the ingress balancer. */
  readonly checkpoint?: MonotonicCheckpoint;
  /** Reuse an existing server DB (server crash/restart with preserveDb). */
  readonly existingDb?: SqlClient;
  readonly onDisposeDb?: () => Promise<void>;
  /**
   * Seed query-checkpoint high-water mark (harness remake after forward clock skew).
   */
  readonly checkpointFloor?: bigint;
};

function buildHandlerCtx(args: {
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
  readonly faults?: EdgeFaultController;
  readonly topicMap?: TopicMap;
}): HarnessServerHandlerCtx {
  const topicMap = withFrameworkTopicMap(args.topicMap);
  return {
    db: args.db,
    now: args.now,
    createId: args.createId,
    pubsub: args.pubsub,
    resolveAuth: args.resolveAuth,
    mutations: args.mutations,
    queries: args.queries,
    getAuth: args.getAuth,
    setAuth: args.setAuth,
    nextCheckpoint: args.nextCheckpoint,
    rowImageFanout: args.rowImageFanout,
    ...(topicMap !== undefined ? { topicMap } : {}),
    ...(args.faults !== undefined
      ? { shouldFailPublish: () => args.faults!.takePublishFault() }
      : {}),
  };
}

function authForQuery(
  ctx: Pick<HarnessServerHandlerCtx, 'resolveAuth' | 'getAuth'>,
  clientNode: string | undefined
): HarnessServerAuth {
  if (clientNode === undefined || clientNode.length === 0) {
    return ctx.getAuth();
  }
  const byDevice = ctx.resolveAuth(`device:${clientNode}`);
  if (!byDevice.isAnon) return byDevice;
  const byNode = ctx.resolveAuth(clientNode);
  if (!byNode.isAnon) return byNode;
  return ctx.getAuth();
}

/** In-memory Bun SQLite server for harness HTTP bridge. */
export async function openHarnessServer(
  args: OpenHarnessServerArgs
): Promise<HarnessServer> {
  let closeDb: () => Promise<void>;
  let db: SqlClient;
  if (args.existingDb !== undefined) {
    db = args.existingDb;
    closeDb = args.onDisposeDb ?? (() => Promise.resolve());
  } else {
    const bundle = await openHarnessSqliteServer(args.localSchema);
    db = bundle.sqlClient;
    closeDb = () => bundle.close();
  }

  // Match createSyncApp / createLocalSyncEngine: product registries are
  // product-only; framework mutations merge at the host boundary.
  const mutations = withFrameworkMutations(args.mutationRegistry);
  const queries = args.queryRegistry;
  let stickyAuth: HarnessServerAuth = {
    actorId: 'server',
    deviceId: 'server',
    accountId: null,
    isAnon: true,
  };

  const checkpoints =
    args.checkpoint ??
    createMonotonicCheckpoint(
      args.now,
      args.checkpointFloor !== undefined
        ? { initialLast: args.checkpointFloor }
        : undefined
    );

  const ctx = buildHandlerCtx({
    db,
    now: args.now,
    createId: args.createId,
    pubsub: args.pubsub,
    resolveAuth: args.resolveAuth,
    mutations,
    queries,
    getAuth: () => stickyAuth,
    setAuth: (auth) => {
      stickyAuth = auth;
    },
    nextCheckpoint: checkpoints.next,
    rowImageFanout: args.rowImageFanout !== false,
    ...(args.topicMap !== undefined ? { topicMap: args.topicMap } : {}),
    ...(args.faults !== undefined ? { faults: args.faults } : {}),
  });

  const handleOneQuery = createHandleQuery(ctx);
  const handleMutations = createHandleMutations(ctx);

  return {
    db,
    setAuth: (auth) => {
      stickyAuth = auth;
    },
    handlers: {
      handleQuery: (reqs, clientNode) => {
        const auth = authForQuery(ctx, clientNode);
        return Promise.all(reqs.map((r) => handleOneQuery(r, auth)));
      },
      handleMutations,
    },
    pruneArtifacts: (olderThanMs) =>
      pruneMutationArtifacts(db, olderThanMs, new Date(args.now())),
    notifyFanout: async ({ topics, tables, label }) => {
      await notifyChannels({
        pubsub: args.pubsub,
        sql: db,
        topics: [...topics],
        tables: [...tables],
        label,
        now: args.now,
      });
    },
    checkpointHighWater: checkpoints.highWater,
    dispose: () => closeDb(),
  };
}
