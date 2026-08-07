import { postgres } from '@pkgs/db-schema/postgres';
import { createLogger } from '@pkgs/logger';
import type { PubSub } from '@pkgs/pubsub/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { applyFrameworkServerDdl } from '@pkgs/sync-engine/shared';

import type { MutationRegistry } from '../mutations/core/types';
import type { QueryRegistry } from '../queries/core/types';
import type { SimHttpServerHandlers } from './http-bridge';
import {
  notesAppSchema,
  notesMutationRegistry,
  notesQueryRegistry,
  readLiveFolders,
  readLiveNotes,
} from './notes-app';
import { openSimPostgres } from './open-sim-postgres';
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
  readonly dispose: () => Promise<void>;
};

export type OpenSimServerArgs = {
  readonly now: () => number;
  readonly pubsub: PubSub;
  readonly resolveAuth: (clientId: string) => SimServerAuth;
  readonly mutationRegistry?: MutationRegistry;
  readonly queryRegistry?: QueryRegistry;
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
    rowImageFanout: true,
  };
}

/** In-process PGlite server for sim HTTP bridge. */
export async function openSimServer(
  args: OpenSimServerArgs
): Promise<SimServer> {
  const pg = await openSimPostgres();
  const db = pg.sqlClient;
  await db.connect();

  const logger = createLogger({ name: 'sim-server', level: 'silent' });
  await applyFrameworkServerDdl({ sqlClient: db, logger });
  await postgres(notesAppSchema, db, { skipAdvisoryLock: true }).reconcile();

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
    dispose: async () => {
      await db.disconnect();
      await pg.close();
    },
  };
}

export async function readServerNotes(db: SqlClient) {
  return readLiveNotes(db);
}

export async function readServerFolders(db: SqlClient) {
  return readLiveFolders(db);
}
