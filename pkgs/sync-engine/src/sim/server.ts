import type { PubSub } from '@pkgs/pubsub/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { LocalDomainSchema } from '../client/local-schema-migrate';
import type { MutationRegistry } from '../mutations/core/types';
import type { QueryRegistry } from '../queries/core/types';
import type { SimHttpServerHandlers } from './http-bridge';
import {
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
  };
}

/** In-memory Bun SQLite server for sim HTTP bridge. */
export async function openSimServer(
  args: OpenSimServerArgs
): Promise<SimServer> {
  const bundle = await openSimSqliteServer(
    args.localSchema ?? notesLocalSchema
  );
  const db = bundle.sqlClient;

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
    dispose: () => bundle.close(),
  };
}

export async function readServerNotes(db: SqlClient) {
  return readLiveNotes(db);
}

export async function readServerFolders(db: SqlClient) {
  return readLiveFolders(db);
}
