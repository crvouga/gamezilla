import { Database } from 'bun:sqlite';
import type { PubSub, Topic } from '@pkgs/pubsub/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite/impl-bun-sqlite';
import { createControllableLifecycle } from '../client/app-lifecycle';
import type { LocalDomainSchema } from '../client/local-schema-migrate';
import type { Timers } from '../client/sim-ports';
import type {
  Mutation,
  MutationEnv,
  MutationRegistry,
} from '../mutations/core/types';
import type { QueryRegistry } from '../queries/core/types';
import type { QueryChannelsCtx } from '../shared/push-payload';
import type { TopicMap } from '../shared/topic-map';
import {
  createEngineFromParts,
  createMutationSide,
  type SimAuthControl,
} from './client-factory-parts';
import { decorateSimClient } from './decorate-sim-client';
import type { SimPushChannels } from './domain-pack';
import type { EdgeFaultController } from './edge-faults';
import type { SimHttpClient } from './http-bridge';
import { createSerialSqlClient } from './serial-sql';
import type { SimServer, SimServerAuth } from './server';
import type { SimClient, SimClientLifecycle } from './sim-client';

export type { SimAuthControl, SimAuthStatus } from './client-factory-parts';
export type {
  SimClient,
  SimClientDbBundle,
  SimClientLifecycle,
  SimRejection,
  SimSubscription,
} from './sim-client';

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
  readonly tableRegistry: LocalDomainSchema;
  readonly mutationRegistry: MutationRegistry;
  readonly queryRegistry: QueryRegistry;
  readonly sessionQuery: {
    readonly name: string;
    readonly params: Readonly<Record<string, unknown>>;
  };
  readonly createPushChannels?: (args: {
    readonly db: SqlClient;
    readonly actorId: string;
  }) => SimPushChannels;
  readonly topicMap?: TopicMap;
  readonly defaultEntryChannel?: (
    params: unknown,
    ctx: QueryChannelsCtx
  ) => readonly Topic[];
  readonly rowImageFanout?: boolean;
  readonly bufferOutboundLive?: boolean;
  readonly authControl?: SimAuthControl;
  readonly schemaEpoch?: number;
  readonly faults?: EdgeFaultController;
  readonly storagePressure?: import('./storage-pressure').StoragePressureController;
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
    abortPending: () => http.abortPending(),
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
    createId: args.createId,
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
    tables: args.tableRegistry,
    mutations: args.mutationRegistry,
    queries: args.queryRegistry,
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
    sessionQuery: args.sessionQuery,
    rowImageFanout: args.rowImageFanout !== false,
    bufferOutboundLive: args.bufferOutboundLive === true,
    ...(args.createPushChannels !== undefined
      ? { createPushChannels: args.createPushChannels }
      : {}),
    ...(args.topicMap !== undefined ? { topicMap: args.topicMap } : {}),
    ...(args.defaultEntryChannel !== undefined
      ? { defaultEntryChannel: args.defaultEntryChannel }
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
    mutations: args.mutationRegistry,
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
): Promise<SimClient> {
  const rawDb = args.existingDb?.raw ?? (await openMemoryDb());
  let db: SqlClient;
  if (args.existingDb !== undefined) {
    db = args.existingDb.serial;
  } else {
    let serialInner = createSerialSqlClient(rawDb);
    if (args.storagePressure !== undefined) {
      serialInner = args.storagePressure.wrap(args.id, serialInner);
    }
    db = serialInner;
  }
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
  const base = {
    id: args.id,
    actorId: args.actorId,
    deviceId: args.deviceId,
    db,
    dbBundle: { raw: rawDb, serial: db },
    engine,
    lifecycle,
    mutationClient,
    mutate: <A>(m: Mutation<A>, a: A) => mutationClient.mutate(m, a),
    http,
    pubsubRemakeCount: args.pubsubRemakeCount,
    subscribedTopics: args.subscribedTopics,
    dispose: async (opts?: { readonly keepDb?: boolean }) => {
      http.abortPending();
      await engine.disconnect();
      http.dispose();
      if (opts?.keepDb === true) return;
      await rawDb.disconnect();
    },
  };
  return decorateSimClient(base);
}
