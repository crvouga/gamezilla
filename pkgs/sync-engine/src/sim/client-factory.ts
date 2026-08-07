import { Database } from 'bun:sqlite';
import type { PubSub } from '@pkgs/pubsub/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';

import { createControllableLifecycle } from '../client/app-lifecycle';
import type { LocalDomainSchema } from '../client/local-schema-migrate';
import type { Timers } from '../client/sim-ports';
import type { SyncEngine } from '../client/sync-engine-port';
import type { MutationClient } from '../mutations/client/create-mutation-client';
import type {
  MutateResult,
  Mutation,
  MutationEnv,
  MutationRegistry,
} from '../mutations/core/types';
import type { QueryRegistry } from '../queries/core/types';
import {
  createEngineFromParts,
  createMutationSide,
} from './client-factory-parts';
import type { SimHttpClient } from './http-bridge';
import {
  simLocalSchema,
  simMutationRegistry,
  simQueryRegistry,
} from './profile';
import { createSerialSqlClient } from './serial-sql';
import type { SimServer, SimServerAuth } from './server';

export type SimClientLifecycle = ReturnType<typeof createControllableLifecycle>;

export type SimClientHandle = {
  readonly id: string;
  readonly actorId: string;
  readonly deviceId: string;
  readonly db: SqlClient;
  readonly engine: SyncEngine;
  readonly lifecycle: SimClientLifecycle;
  readonly mutate: <A>(m: Mutation<A>, args: A) => Promise<MutateResult>;
  readonly mutationClient: MutationClient;
  readonly http: SimHttpClient;
  readonly dispose: () => Promise<void>;
};

export type BuildSimClientArgs = {
  readonly id: string;
  readonly actorId: string;
  readonly deviceId: string;
  readonly now: () => number;
  readonly random: () => number;
  readonly timers: Timers;
  readonly createId: () => string;
  readonly http: SimHttpClient;
  readonly server: SimServer;
  readonly auth: SimServerAuth;
  readonly createPubSub: () => PubSub;
  readonly tableRegistry?: LocalDomainSchema;
  readonly mutationRegistry?: MutationRegistry;
  readonly queryRegistry?: QueryRegistry;
  readonly fallbackPollMs?: number;
  readonly reconcileMs?: number;
};

async function openMemoryDb(): Promise<SqlClient> {
  const raw = new Database(':memory:');
  const db = new SqlClientImplBunSqlite(raw);
  await db.connect();
  return db;
}

function wireHttp(
  http: SimHttpClient,
  server: SimServer,
  auth: SimServerAuth
): SimHttpClient {
  return {
    postQuery: async (req) => {
      server.setAuth(auth);
      return http.postQuery(req);
    },
    postQueryBatch: async (reqs) => {
      server.setAuth(auth);
      return http.postQueryBatch(reqs);
    },
    postMutations: (mutations) => http.postMutations(mutations),
    dispose: () => http.dispose(),
  };
}

function mutationEnvFromArgs(args: BuildSimClientArgs): () => MutationEnv {
  return () => ({
    actorId: args.actorId,
    deviceId: args.deviceId,
    accountId: args.auth.accountId,
    isAnon: args.auth.isAnon,
    now: () => new Date(args.now()),
  });
}

/** Build one local sync engine + mutation client on Bun SQLite. */
export async function buildSimClient(
  args: BuildSimClientArgs
): Promise<SimClientHandle> {
  const rawDb = await openMemoryDb();
  const db = createSerialSqlClient(rawDb);
  const lifecycle = createControllableLifecycle({
    foreground: true,
    online: true,
  });
  const tables = args.tableRegistry ?? simLocalSchema;
  const mutations = args.mutationRegistry ?? simMutationRegistry;
  const queries = args.queryRegistry ?? simQueryRegistry;
  const http = wireHttp(args.http, args.server, args.auth);
  const getEnv = mutationEnvFromArgs(args);

  const engine = await createEngineFromParts({
    db,
    tables,
    mutations,
    queries,
    getEnv,
    deviceId: args.deviceId,
    actorId: args.actorId,
    http,
    lifecycle,
    now: args.now,
    random: args.random,
    timers: args.timers,
    createId: args.createId,
    createPubSub: args.createPubSub,
    ...(args.fallbackPollMs !== undefined
      ? { fallbackPollMs: args.fallbackPollMs }
      : {}),
    ...(args.reconcileMs !== undefined
      ? { reconcileMs: args.reconcileMs }
      : {}),
  });

  const mutationClient = createMutationSide({
    db,
    mutations,
    getEnv,
    deviceId: args.deviceId,
    createId: args.createId,
    lifecycle,
    engine,
  });

  await engine.connect();

  return {
    id: args.id,
    actorId: args.actorId,
    deviceId: args.deviceId,
    db,
    engine,
    lifecycle,
    mutationClient,
    mutate: (m, a) => mutationClient.mutate(m, a),
    http,
    dispose: async () => {
      // Reject in-flight sim HTTP first so upload-queue stop() can unwind.
      http.dispose();
      await engine.disconnect();
      await rawDb.disconnect();
    },
  };
}
