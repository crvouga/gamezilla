import type { PubSub } from '@pkgs/pubsub/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { pruneMutationArtifacts } from '@pkgs/sync-engine/server';
import type { CreateId } from '@pkgs/uuid';

import type { LocalDomainSchema } from '../client/local-schema-migrate';
import type { MutationRegistry } from '../mutations/core/types';
import { withFrameworkMutations } from '../mutations/shared/with-framework-mutations';
import type { QueryRegistry } from '../queries/core/types';
import { notifyChannels } from '../server/notify-channels';
import { createMonotonicCheckpoint } from '../shared/commit-checkpoint';
import { withFrameworkTopicMap } from '../shared/framework-topic-map';
import type { TopicMap } from '../shared/topic-map';
import type { BoundaryFaultController } from './boundary-faults';
import type { SimHttpServerHandlers } from './http-bridge';
import { openSimSqliteServer } from './open-sim-sqlite';
import {
  createHandleMutations,
  createHandleQuery,
  type SimServerAuth,
  type SimServerHandlerCtx,
} from './server-handlers';

export type { SimServerAuth };

export type SimServer = {
  readonly db: SqlClient;
  readonly handlers: SimHttpServerHandlers;
  readonly setAuth: (auth: SimServerAuth) => void;
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

export type OpenSimServerArgs = {
  readonly now: () => number;
  readonly createId: CreateId;
  readonly pubsub: PubSub;
  readonly resolveAuth: (clientId: string) => SimServerAuth;
  readonly mutationRegistry: MutationRegistry;
  readonly queryRegistry: QueryRegistry;
  readonly localSchema: LocalDomainSchema;
  readonly rowImageFanout?: boolean;
  readonly faults?: BoundaryFaultController;
  readonly topicMap?: TopicMap;
  /** Reuse an existing server DB (server crash/restart with preserveDb). */
  readonly existingDb?: SqlClient;
  readonly onDisposeDb?: () => Promise<void>;
  /**
   * Seed query-checkpoint high-water mark (sim remake after forward clock skew).
   */
  readonly checkpointFloor?: bigint;
};

function buildHandlerCtx(args: {
  readonly db: SqlClient;
  readonly now: () => number;
  readonly createId: CreateId;
  readonly pubsub: PubSub;
  readonly resolveAuth: (clientId: string) => SimServerAuth;
  readonly mutations: MutationRegistry;
  readonly queries: QueryRegistry;
  readonly getAuth: () => SimServerAuth;
  readonly setAuth: (auth: SimServerAuth) => void;
  readonly nextCheckpoint: () => string;
  readonly rowImageFanout: boolean;
  readonly faults?: BoundaryFaultController;
  readonly topicMap?: TopicMap;
}): SimServerHandlerCtx {
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
  ctx: Pick<SimServerHandlerCtx, 'resolveAuth' | 'getAuth'>,
  clientNode: string | undefined
): SimServerAuth {
  if (clientNode === undefined || clientNode.length === 0) {
    return ctx.getAuth();
  }
  const byDevice = ctx.resolveAuth(`device:${clientNode}`);
  if (!byDevice.isAnon) return byDevice;
  const byNode = ctx.resolveAuth(clientNode);
  if (!byNode.isAnon) return byNode;
  return ctx.getAuth();
}

/** In-memory Bun SQLite server for sim HTTP bridge. */
export async function openSimServer(
  args: OpenSimServerArgs
): Promise<SimServer> {
  let closeDb: () => Promise<void>;
  let db: SqlClient;
  if (args.existingDb !== undefined) {
    db = args.existingDb;
    closeDb = args.onDisposeDb ?? (() => Promise.resolve());
  } else {
    const bundle = await openSimSqliteServer(args.localSchema);
    db = bundle.sqlClient;
    closeDb = () => bundle.close();
  }

  // Match createSyncApp / createLocalSyncEngine: product registries are
  // product-only; framework mutations merge at the host boundary.
  const mutations = withFrameworkMutations(args.mutationRegistry);
  const queries = args.queryRegistry;
  let stickyAuth: SimServerAuth = {
    actorId: 'server',
    deviceId: 'server',
    accountId: null,
    isAnon: true,
  };

  const checkpoints = createMonotonicCheckpoint(
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
