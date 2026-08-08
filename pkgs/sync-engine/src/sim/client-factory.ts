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
import type { BoundaryFaultController } from './boundary-faults';
import {
  createEngineFromParts,
  createMutationSide,
  type SimAuthControl,
} from './client-factory-parts';
import type { SimHttpClient } from './http-bridge';
import {
  notesLocalSchema,
  notesMutationRegistry,
  notesQueryRegistry,
} from './notes-app';
import { createSerialSqlClient } from './serial-sql';
import type { SimServer, SimServerAuth } from './server';

export type SimClientLifecycle = ReturnType<typeof createControllableLifecycle>;
export type { SimAuthControl, SimAuthStatus } from './client-factory-parts';

export type SimClientDbBundle = {
  readonly raw: SqlClient;
  readonly serial: SqlClient;
};

export type SimClientHandle = {
  readonly id: string;
  readonly actorId: string;
  readonly deviceId: string;
  readonly db: SqlClient;
  /** Underlying DB handles for preserveLocalDb restarts. */
  readonly dbBundle: SimClientDbBundle;
  readonly engine: SyncEngine;
  readonly lifecycle: SimClientLifecycle;
  readonly mutate: <A>(m: Mutation<A>, args: A) => Promise<MutateResult>;
  readonly mutationClient: MutationClient;
  readonly http: SimHttpClient;
  /** createPubSub invocations (bootstrap + each remake). */
  readonly pubsubRemakeCount: () => number;
  /** Live pubsub handler topics for this client. */
  readonly subscribedTopics: () => readonly string[];
  /** Dispose engine + HTTP; optionally keep the SQLite DB for preserveLocalDb. */
  readonly dispose: (opts?: { readonly keepDb?: boolean }) => Promise<void>;
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
  readonly pubsubRemakeCount: () => number;
  readonly subscribedTopics: () => readonly string[];
  readonly tableRegistry?: LocalDomainSchema;
  readonly mutationRegistry?: MutationRegistry;
  readonly queryRegistry?: QueryRegistry;
  readonly rowImageFanout?: boolean;
  readonly bufferOutboundLive?: boolean;
  readonly sessionQuery?: {
    readonly name: string;
    readonly params: Readonly<Record<string, unknown>>;
  };
  readonly authControl?: SimAuthControl;
  readonly schemaEpoch?: number;
  readonly faults?: BoundaryFaultController;
  /** Reuse an existing serial SqlClient (preserveLocalDb restart). */
  readonly existingDb?: {
    readonly raw: SqlClient;
    readonly serial: SqlClient;
  };
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
    postQueries: async (reqs) => {
      server.setAuth(auth);
      return http.postQueries(reqs);
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

async function connectEngine(
  args: BuildSimClientArgs,
  db: SqlClient,
  http: SimHttpClient,
  lifecycle: SimClientLifecycle
) {
  const getEnv = mutationEnvFromArgs(args);
  const engine = await createEngineFromParts({
    db,
    tables: args.tableRegistry ?? notesLocalSchema,
    mutations: args.mutationRegistry ?? notesMutationRegistry,
    queries: args.queryRegistry ?? notesQueryRegistry,
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
    rowImageFanout: args.rowImageFanout !== false,
    bufferOutboundLive: args.bufferOutboundLive === true,
    ...(args.sessionQuery !== undefined
      ? { sessionQuery: args.sessionQuery }
      : {}),
    ...(args.authControl !== undefined
      ? { authControl: args.authControl }
      : {}),
    ...(args.schemaEpoch !== undefined
      ? { schemaEpoch: args.schemaEpoch }
      : {}),
    onLocalMigratePhase: async (phase) => {
      if (
        phase === 'afterCacheWipe' &&
        args.faults?.takeCrash(args.id, 'onNextEngineOpenAfterCacheWipe') ===
          true
      ) {
        throw new Error('sim: crash during epoch migrate after cache wipe');
      }
    },
  });
  const mutationClient = createMutationSide({
    db,
    mutations: args.mutationRegistry ?? notesMutationRegistry,
    getEnv,
    deviceId: args.deviceId,
    createId: args.createId,
    lifecycle,
    engine,
  });
  await engine.connect();
  return { engine, mutationClient };
}

/** Build one local sync engine + mutation client on Bun SQLite. */
export async function buildSimClient(
  args: BuildSimClientArgs
): Promise<SimClientHandle> {
  const rawDb = args.existingDb?.raw ?? (await openMemoryDb());
  const db = args.existingDb?.serial ?? createSerialSqlClient(rawDb);
  const lifecycle = createControllableLifecycle({
    foreground: true,
    online: true,
  });
  const http = wireHttp(args.http, args.server, args.auth);
  const { engine, mutationClient } = await connectEngine(
    args,
    db,
    http,
    lifecycle
  );
  return {
    id: args.id,
    actorId: args.actorId,
    deviceId: args.deviceId,
    db,
    dbBundle: { raw: rawDb, serial: db },
    engine,
    lifecycle,
    mutationClient,
    mutate: (m, a) => mutationClient.mutate(m, a),
    http,
    pubsubRemakeCount: args.pubsubRemakeCount,
    subscribedTopics: args.subscribedTopics,
    dispose: async (opts) => {
      http.dispose();
      await engine.disconnect();
      if (opts?.keepDb === true) return;
      await rawDb.disconnect();
    },
  };
}
