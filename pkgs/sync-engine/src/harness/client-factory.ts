import { Database } from 'bun:sqlite';
import type { PubSub, Topic } from '@pkgs/pubsub/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite/impl-bun-sqlite';
import { createControllableLifecycle } from '../client/app-lifecycle';
import type { Timers } from '../client/harness-ports';
import type { LocalDomainSchema } from '../client/local-schema-migrate';
import type {
  Mutation,
  MutationEnv,
  MutationRegistry,
} from '../mutations/core/types';
import type { QueryRegistry } from '../queries/core/types';
import type { QueryChannelsCtx } from '../shared/push-payload';
import type { TopicMap } from '../shared/topic-map';
import type { HarnessClient, HarnessClientLifecycle } from './client';
import {
  createEngineFromParts,
  createMutationSide,
  type HarnessAuthControl,
} from './client-factory-parts';
import { decorateHarnessClient } from './decorate-harness-client';
import type { HarnessPushChannels } from './domain-pack';
import type { EdgeFaultController } from './edge-faults';
import type { HarnessHttpClient } from './http-bridge';
import { createSerialSqlClient } from './serial-sql';
import type { HarnessServer, HarnessServerAuth } from './server';

export type {
  HarnessClient,
  HarnessClientDbBundle,
  HarnessClientLifecycle,
  HarnessRejection,
  HarnessSubscription,
} from './client';
export type {
  HarnessAuthControl,
  HarnessAuthStatus,
} from './client-factory-parts';

export type BuildHarnessClientArgs = {
  readonly id: string;
  readonly actorId: string;
  readonly deviceId: string;
  readonly now: () => number;
  readonly random: () => number;
  readonly timers: Timers;
  readonly createId: () => string;
  readonly http: HarnessHttpClient;
  readonly server: HarnessServer;
  readonly auth: HarnessServerAuth;
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
  }) => HarnessPushChannels;
  readonly topicMap?: TopicMap;
  readonly defaultEntryChannel?: (
    params: unknown,
    ctx: QueryChannelsCtx
  ) => readonly Topic[];
  readonly rowImageFanout?: boolean;
  readonly bufferOutboundLive?: boolean;
  readonly authControl?: HarnessAuthControl;
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
  http: HarnessHttpClient,
  server: HarnessServer,
  auth: HarnessServerAuth
): HarnessHttpClient {
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

function mutationEnvFromArgs(args: BuildHarnessClientArgs): () => MutationEnv {
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
  args: BuildHarnessClientArgs,
  db: SqlClient,
  http: HarnessHttpClient,
  lifecycle: HarnessClientLifecycle
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
        throw new Error('harness: crash during epoch migrate after cache wipe');
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
export async function buildHarnessClient(
  args: BuildHarnessClientArgs
): Promise<HarnessClient> {
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
  return decorateHarnessClient(base);
}
