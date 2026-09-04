import { createInMemoryDevMenuPort } from '@apps/client/device/in-memory-dev-menu-port';
import { createInMemoryNetworkStatePort } from '@apps/client/device/in-memory-network-state-port';
import { createInProcessRoomNode } from '@apps/client/host/in-process-room-node';
import type { ClientEnv } from '@apps/client/product/client-env';
import { type Client, createClient } from '@apps/client/product/create-client';
import { createServer, type ServerEnv, serveFetch } from '@apps/server';
import { loadBetterAuthBootConfig } from '@apps/server/config/better-auth-boot';
import {
  migrateSimSqlite,
  SIM_BETTER_AUTH_SECRET,
  SIM_SERVER_URL,
  SIM_SQLITE_DATABASE_URL,
} from '@apps/server/system/migrate-sim-sqlite';
import { createInMemoryStripe } from '@libs/stripe/root/in-memory-stripe';
import { createNamespacedAuthClientStorage } from '@pkgs/auth-better-auth/client';
import type { SimClock } from '@pkgs/clock';
import { KvImplInMemory } from '@pkgs/kv/impl-in-memory';
import { KvImplWebNamespaced } from '@pkgs/kv/impl-kv-web-namespaced';
import { InMemoryLlmProvider } from '@pkgs/llm/server';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import { createNoopObservability } from '@pkgs/observability/impl-noop/impl-noop';
import {
  createInMemoryBus,
  createInMemoryPubSub,
} from '@pkgs/pubsub/testing/in-memory';
import { createRecordSecretStore } from '@pkgs/secret-store/record-secret-store';
import { createNamespacedWebSecureStorage } from '@pkgs/secure-storage/impl-web';
import { createSecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';
import { createInMemoryAudioPlaybackPort } from '@pkgs/sounds/audio-playback/in-memory-audio-playback-port';
import { InMemoryTtsProvider } from '@pkgs/tts/server';
import { createSimAdapters } from '@pkgs/uuid';
import { serializeFetch } from './sim-fetch';
import { createSimNet } from './sim-net';
import {
  handleBoundSqlClient,
  openFreshSimSql,
  type SimSqlHandle,
  sharedSqlClient,
} from './sim-sql';

export type CreateSimOptions = {
  readonly seed?: number | bigint | string;
  readonly startMs?: number;
  /** Override virtual timers (openSim injects node timers for RNTL). */
  readonly timers?: import('@pkgs/clock').Timers;
};

export type Server = Awaited<ReturnType<typeof createServer>>;

export type Sim = {
  readonly server: ServerEnv;
  readonly clock: SimClock;
  readonly pubSubBus: ReturnType<typeof createInMemoryBus>;
  client(id: string): ClientEnv;
  spawnServer(): Promise<Server>;
  spawnClient(id: string, env?: ClientEnv): Client;
  dropClient(id: string): Promise<void>;
  bumpClientEpoch(): void;
  crash(id: 'server' | string): void;
  restart(id: string): void;
  partition(a: string, b: string): void;
  heal(a?: string, b?: string): void;
  dispose(): Promise<void>;
  readonly roomNode: ReturnType<typeof createInProcessRoomNode>;
  readonly serverSql: SimSqlHandle;
  clientSql(id: string): SimSqlHandle | undefined;
};

let clientDurableEpoch = 0;

export function bumpSimClientEpoch(): number {
  clientDurableEpoch += 1;
  return clientDurableEpoch;
}

export function simClientNamespace(id: string): string {
  return `sim_client_${id}_e${clientDurableEpoch}`;
}

async function buildServerEnv(args: {
  readonly adapters: ReturnType<typeof createSimAdapters>;
  readonly timers: import('@pkgs/clock').Timers;
  readonly serverSql: SimSqlHandle;
  readonly pubSubBus: ReturnType<typeof createInMemoryBus>;
}): Promise<ServerEnv> {
  const { adapters, timers, serverSql, pubSubBus } = args;
  const shared = sharedSqlClient(serverSql.sqlClient);
  const secrets = createRecordSecretStore({
    BETTER_AUTH_SECRET: SIM_BETTER_AUTH_SECRET,
    DATABASE_URL: SIM_SQLITE_DATABASE_URL,
    API_URL: SIM_SERVER_URL,
  });
  const betterAuth = await loadBetterAuthBootConfig({
    secretStore: secrets,
    apiUrlOverride: SIM_SERVER_URL,
    secretsEnv: 'dev',
  });
  return {
    clock: adapters.clock,
    timers: args.timers,
    createId: adapters.createId,
    random: adapters.random,
    seed: adapters.seed,
    openSqlClient: async () => shared,
    events: createInMemoryPubSub({ bus: pubSubBus }),
    kv: new KvImplInMemory(),
    blob: new ObjectStoreImplInMemory(),
    payments: createInMemoryStripe({ baseUrl: SIM_SERVER_URL }),
    tts: new InMemoryTtsProvider(),
    llm: new InMemoryLlmProvider(),
    secrets,
    observability: createNoopObservability('sim-server'),
    betterAuth,
    secretsEnv: 'dev',
    serverUrl: SIM_SERVER_URL,
    skipDatabaseUrlPolicy: true,
    fetch: async () => {
      throw new Error('sim ServerEnv.fetch: vendor HTTP not configured');
    },
  };
}

function clientNamespace(id: string): string {
  return `sim_client_${id}`;
}

/**
 * Playground + openSim fabric. Production never calls this.
 */
export async function createSim(opts?: CreateSimOptions): Promise<Sim> {
  const adapters = createSimAdapters({
    seed: opts?.seed ?? 1,
    startMs: opts?.startMs ?? 0,
  });
  const net = createSimNet();
  const pubSubBus = createInMemoryBus();
  const serverSql = await openFreshSimSql('sim_server', adapters.clock);
  await migrateSimSqlite({
    sqlClient: serverSql.sqlClient,
    now: adapters.clock.now,
  });
  const roomNode = createInProcessRoomNode({
    clock: adapters.clock,
    timers: adapters.timers,
    createId: adapters.createId,
  });
  const serverEnv = await buildServerEnv({ adapters, serverSql, pubSubBus });
  const clientSql = new Map<string, SimSqlHandle>();
  const clientEnvs = new Map<string, ClientEnv>();
  const liveClients = new Map<string, Client>();
  let rawServerFetch: ReturnType<typeof serveFetch> | null = null;
  let hono: Server | null = null;
  let disposed = false;

  const serverFetch: ClientEnv['server'] = serializeFetch(
    async (input, init) => {
      if (rawServerFetch === null) {
        throw new Error('createSim: spawnServer before client HTTP');
      }
      return rawServerFetch(input, init);
    }
  );

  function client(id: string): ClientEnv {
    const existing = clientEnvs.get(id);
    if (existing !== undefined) return existing;
    const ns = clientNamespace(id);
    const env: ClientEnv = {
      clock: adapters.clock,
      timers: adapters.timers,
      createId: adapters.createId,
      random: adapters.random,
      seed: adapters.seed,
      server: net.wrapServerHttp(id, serverFetch),
      events: createInMemoryPubSub({ bus: pubSubBus }),
      openSqlClient: async () => {
        let handle = clientSql.get(id);
        if (handle === undefined) {
          handle = await openFreshSimSql(`sim_client_${id}`, adapters.clock);
          clientSql.set(id, handle);
        }
        return handleBoundSqlClient(handle);
      },
      kv: new KvImplWebNamespaced(ns),
      authStorage: createNamespacedAuthClientStorage(ns),
      secureStorage: createSecureStorageStore(
        createNamespacedWebSecureStorage(ns)
      ),
      room: (args) => {
        net.assertReachable(id, 'server');
        return roomNode.createTransport(args);
      },
      network: createInMemoryNetworkStatePort(),
      audio: createInMemoryAudioPlaybackPort(),
      devMenu: createInMemoryDevMenuPort(),
      observability: createNoopObservability(`sim-client:${id}`),
      serverUrl: SIM_SERVER_URL,
      authBaseURL: SIM_SERVER_URL,
    };
    clientEnvs.set(id, env);
    return env;
  }

  const sim: Sim = {
    server: serverEnv,
    clock: adapters.clock,
    client,
    async spawnServer() {
      if (hono !== null) return hono;
      hono = await createServer(serverEnv);
      rawServerFetch = serveFetch((request) => hono!.fetch(request));
      return hono;
    },
    spawnClient(id: string) {
      const live = createClient(client(id));
      liveClients.set(id, live);
      return live;
    },
    crash(id) {
      net.crash(id);
    },
    restart(id) {
      net.restart(id);
    },
    partition(a, b) {
      net.partition(a, b);
    },
    heal(a, b) {
      net.heal(a, b);
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      for (const live of liveClients.values()) await live.close();
      liveClients.clear();
      roomNode.dispose();
      for (const handle of clientSql.values()) await handle.disconnect();
      clientSql.clear();
      await serverSql.disconnect();
    },
    roomNode,
    serverSql,
    clientSql(id) {
      return clientSql.get(id);
    },
  };
  return sim;
}
