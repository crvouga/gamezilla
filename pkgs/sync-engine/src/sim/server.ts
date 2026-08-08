import type { PubSub } from '@pkgs/pubsub/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { pruneMutationArtifacts } from '@pkgs/sync-engine/server';

import type { LocalDomainSchema } from '../client/local-schema-migrate';
import type { MutationRegistry } from '../mutations/core/types';
import { withFrameworkMutations } from '../mutations/shared/with-framework-mutations';
import type { QueryRegistry } from '../queries/core/types';
import { notifyChannels } from '../server/notify-channels';
import { withFrameworkTopicMap } from '../shared/framework-topic-map';
import type { TopicMap } from '../shared/topic-map';
import type { BoundaryFaultController } from './boundary-faults';
import type { SimHttpServerHandlers } from './http-bridge';
import { openSimSqliteServer } from './open-sim-sqlite';
import {
  commitCheckpoint,
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
  readonly dispose: () => Promise<void>;
};

export type OpenSimServerArgs = {
  readonly now: () => number;
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
};

function buildHandlerCtx(args: {
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
  readonly faults?: BoundaryFaultController;
  readonly topicMap?: TopicMap;
}): SimServerHandlerCtx {
  const topicMap = withFrameworkTopicMap(args.topicMap);
  return {
    db: args.db,
    now: args.now,
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
  let checkpointSeq = 0;
  let stickyAuth: SimServerAuth = {
    actorId: 'server',
    deviceId: 'server',
    accountId: null,
    isAnon: true,
  };

  const ctx = buildHandlerCtx({
    db,
    now: args.now,
    pubsub: args.pubsub,
    resolveAuth: args.resolveAuth,
    mutations,
    queries,
    getAuth: () => stickyAuth,
    setAuth: (auth) => {
      stickyAuth = auth;
    },
    nextCheckpoint: () => {
      checkpointSeq += 1;
      return commitCheckpoint(args.now(), checkpointSeq);
    },
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
      handleQuery: (reqs) => Promise.all(reqs.map((r) => handleOneQuery(r))),
      handleMutations,
    },
    pruneArtifacts: (olderThanMs) =>
      pruneMutationArtifacts(db, olderThanMs, new Date(args.now())),
    notifyFanout: async ({ topics, tables, label }) => {
      notifyChannels({
        pubsub: args.pubsub,
        sql: db,
        topics: [...topics],
        tables: [...tables],
        label,
      });
    },
    dispose: () => closeDb(),
  };
}
