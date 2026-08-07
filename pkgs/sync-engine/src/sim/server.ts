import type { PubSub } from '@pkgs/pubsub/interface';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { createPgMemSqlClient } from '@pkgs/sql-client/postgres/impl-pg-mem';

import type { MutationRegistry } from '../mutations/core/types';
import type { QueryRegistry } from '../queries/core/types';
import type { SimHttpServerHandlers } from './http-bridge';
import {
  applyServerDdlSqlClient,
  simMutationRegistry,
  simQueryRegistry,
} from './profile';
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
  };
}

/** In-process pg-mem server for sim HTTP bridge. */
export async function openSimServer(
  args: OpenSimServerArgs
): Promise<SimServer> {
  const { sqlClient: db } = createPgMemSqlClient();
  await db.connect();
  await applyServerDdlSqlClient(db);

  const mutations = args.mutationRegistry ?? simMutationRegistry;
  const queries = args.queryRegistry ?? simQueryRegistry;
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

  const handleQuery = createHandleQuery(ctx);
  const handleMutations = createHandleMutations(ctx);

  return {
    db,
    setAuth: (auth) => {
      stickyAuth = auth;
    },
    handlers: {
      handleQuery,
      handleQueryBatch: (reqs) => Promise.all(reqs.map((r) => handleQuery(r))),
      handleMutations,
    },
    dispose: async () => {
      await db.disconnect();
    },
  };
}

export async function readServerNotes(
  db: SqlClient
): Promise<readonly { id: string; body: string; owner_id: string }[]> {
  return db.query(sql<{ id: string; body: string; owner_id: string }>`
    SELECT id, body, owner_id FROM notes ORDER BY id ASC
  `);
}
