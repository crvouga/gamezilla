import type { PubSub } from '@pkgs/pubsub/interface';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { pruneMutationArtifacts } from '@pkgs/sync-engine/server';

import type { LocalDomainSchema } from '../client/local-schema-migrate';
import type { MutationRegistry } from '../mutations/core/types';
import type { QueryRegistry } from '../queries/core/types';
import { allocateTopicPushSeqs } from '../server/allocate-topic-push-seq';
import { notifyChannels } from '../server/notify-channels';
import type { BoundaryFaultController } from './boundary-faults';
import type { SimHttpServerHandlers } from './http-bridge';
import {
  NOTES_WORLD_TOPIC,
  notesLocalSchema,
  notesMutationRegistry,
  notesQueryRegistry,
  readLiveFolders,
  readLiveNotes,
} from './notes-app';
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
   * Direct domain write bypassing mutations. When `notify` is false, peers
   * stay stale until a refetch trigger (documented footgun).
   */
  readonly writeNoteBody: (args: {
    readonly id: string;
    readonly body: string;
    readonly notify?: boolean;
  }) => Promise<void>;
  readonly dispose: () => Promise<void>;
};

export type OpenSimServerArgs = {
  readonly now: () => number;
  readonly pubsub: PubSub;
  readonly resolveAuth: (clientId: string) => SimServerAuth;
  readonly mutationRegistry?: MutationRegistry;
  readonly queryRegistry?: QueryRegistry;
  readonly localSchema?: LocalDomainSchema;
  readonly rowImageFanout?: boolean;
  readonly faults?: BoundaryFaultController;
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
}): SimServerHandlerCtx {
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
    const bundle = await openSimSqliteServer(
      args.localSchema ?? notesLocalSchema
    );
    db = bundle.sqlClient;
    closeDb = () => bundle.close();
  }

  const mutations = args.mutationRegistry ?? notesMutationRegistry;
  const queries = args.queryRegistry ?? notesQueryRegistry;
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
    writeNoteBody: async ({ id, body, notify }) => {
      await db.run(sql`
        UPDATE notes SET body = ${body} WHERE id = ${id}
      `);
      if (notify === true) {
        const checkpoints = await allocateTopicPushSeqs(db, [
          NOTES_WORLD_TOPIC,
        ]);
        for (const [topic, pushSeq] of checkpoints) {
          notifyChannels({
            pubsub: args.pubsub,
            topics: [topic],
            pushSeq,
            tables: ['notes'],
            label: 'writeNoteBody',
          });
        }
      }
    },
    dispose: () => closeDb(),
  };
}

export async function readServerNotes(db: SqlClient) {
  return readLiveNotes(db);
}

export async function readServerFolders(db: SqlClient) {
  return readLiveFolders(db);
}
