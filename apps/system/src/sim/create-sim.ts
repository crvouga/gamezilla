import { createInMemoryDevMenuPort } from '@apps/client/device/in-memory-dev-menu-port';
import { createInMemoryNetworkStatePort } from '@apps/client/device/in-memory-network-state-port';
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
import { createInProcessRoomNode } from '@apps/system/playground/in-process-room-node';
import { assert } from '@pkgs/assert';
import { createNamespacedAuthClientStorage } from '@pkgs/auth-better-auth/client';
import { InMemoryBilling } from '@pkgs/billing';
import type { SimClock, Timers } from '@pkgs/clock';
import { KvImplInMemory } from '@pkgs/kv/impl-in-memory';
import { InMemoryLlmProvider } from '@pkgs/llm/server';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import { createNoopObservability } from '@pkgs/observability/impl-noop/impl-noop';
import {
  createInMemoryBus,
  createInMemoryPubSub,
} from '@pkgs/pubsub/testing/in-memory';
import { createRecordSecretStore } from '@pkgs/secret-store/record-secret-store';
import { createInMemorySecureStorage } from '@pkgs/secure-storage/impl-memory';
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
  readonly timers?: Timers;
  /** Max-fidelity host injects Postgres; playground omits this. */
  readonly serverSql?: SimSqlHandle;
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
  clientIds(): readonly string[];
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
  readonly timers: Timers;
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
    timers,
    createId: adapters.createId,
    random: adapters.random,
    seed: adapters.seed,
    openSqlClient: async () => shared,
    events: createInMemoryPubSub({ bus: pubSubBus }),
    kv: new KvImplInMemory(),
    blob: new ObjectStoreImplInMemory(),
    billing: new InMemoryBilling({ baseUrl: SIM_SERVER_URL }),
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

type SimKernel = {
  readonly adapters: ReturnType<typeof createSimAdapters>;
  readonly timers: Timers;
  readonly net: ReturnType<typeof createSimNet>;
  readonly pubSubBus: ReturnType<typeof createInMemoryBus>;
  readonly serverSql: SimSqlHandle;
  readonly roomNode: ReturnType<typeof createInProcessRoomNode>;
  readonly serverEnv: ServerEnv;
};

async function bootSimKernel(opts?: CreateSimOptions): Promise<SimKernel> {
  const adapters = createSimAdapters({
    seed: opts?.seed ?? 1,
    startMs: opts?.startMs ?? 0,
  });
  const timers = opts?.timers ?? adapters.timers;
  const net = createSimNet();
  const pubSubBus = createInMemoryBus();
  const serverSql =
    opts?.serverSql ?? (await openFreshSimSql('sim_server', adapters.clock));
  if (opts?.serverSql === undefined) {
    await migrateSimSqlite({
      sqlClient: serverSql.sqlClient,
      now: adapters.clock.now,
    });
  }
  const roomNode = createInProcessRoomNode({
    clock: adapters.clock,
    timers,
    createId: adapters.createId,
  });
  const serverEnv = await buildServerEnv({
    adapters,
    timers,
    serverSql,
    pubSubBus,
  });
  return { adapters, timers, net, pubSubBus, serverSql, roomNode, serverEnv };
}

function makeSimClientEnv(
  kernel: SimKernel,
  args: {
    readonly id: string;
    readonly serverFetch: ClientEnv['server'];
    readonly clientSql: Map<string, SimSqlHandle>;
  }
): ClientEnv {
  const { adapters, timers, net, pubSubBus, roomNode } = kernel;
  const { id, serverFetch, clientSql } = args;
  const ns = simClientNamespace(id);
  let liveEvents: ReturnType<typeof createInMemoryPubSub> | null = null;
  const createPubSub = (): ReturnType<typeof createInMemoryPubSub> => {
    liveEvents?.close();
    liveEvents = createInMemoryPubSub({ bus: pubSubBus });
    return liveEvents;
  };
  liveEvents = createInMemoryPubSub({ bus: pubSubBus });
  return {
    clock: adapters.clock,
    timers,
    createId: adapters.createId,
    random: adapters.random,
    seed: adapters.seed,
    server: net.wrapServerHttp(id, serverFetch),
    get events() {
      assert.defined(liveEvents, 'sim client events');
      return liveEvents;
    },
    createPubSub,
    openSqlClient: async () => {
      let handle = clientSql.get(id);
      if (handle === undefined) {
        handle = await openFreshSimSql(`sim_client_${id}`, adapters.clock);
        clientSql.set(id, handle);
      }
      return handleBoundSqlClient(handle);
    },
    kv: new KvImplInMemory(),
    authStorage: createNamespacedAuthClientStorage(ns),
    secureStorage: createSecureStorageStore(createInMemorySecureStorage()),
    room: (roomArgs) => {
      net.assertReachable(id, 'server');
      return roomNode.createTransport(roomArgs);
    },
    network: createInMemoryNetworkStatePort(),
    audio: createInMemoryAudioPlaybackPort(),
    devMenu: createInMemoryDevMenuPort(),
    observability: createNoopObservability(`sim-client:${id}`),
    serverUrl: SIM_SERVER_URL,
    authBaseURL: SIM_SERVER_URL,
    resolveDatabaseName: () => ns,
  };
}

async function disposeSim(args: {
  disposed: { value: boolean };
  liveClients: Map<string, Client>;
  roomNode: ReturnType<typeof createInProcessRoomNode>;
  clientSql: Map<string, SimSqlHandle>;
  serverSql: SimSqlHandle;
}): Promise<void> {
  if (args.disposed.value) return;
  args.disposed.value = true;
  for (const live of args.liveClients.values()) await live.close();
  args.liveClients.clear();
  args.roomNode.dispose();
  for (const handle of args.clientSql.values()) await handle.disconnect();
  args.clientSql.clear();
  await args.serverSql.disconnect();
}

function createSimHandle(kernel: SimKernel): Sim {
  const { adapters, net, pubSubBus, serverSql, roomNode, serverEnv } = kernel;
  const clientSql = new Map<string, SimSqlHandle>();
  const liveClients = new Map<string, Client>();
  const disposed = { value: false };
  let rawServerFetch: ReturnType<typeof serveFetch> | null = null;
  let hono: Server | null = null;
  const serverFetch: ClientEnv['server'] = serializeFetch(
    async (input, init) => {
      if (rawServerFetch === null) {
        throw new Error('createSim: spawnServer before client HTTP');
      }
      return rawServerFetch(input, init);
    }
  );
  const client = (id: string): ClientEnv =>
    makeSimClientEnv(kernel, { id, serverFetch, clientSql });
  return {
    server: serverEnv,
    clock: adapters.clock,
    pubSubBus,
    client,
    async spawnServer() {
      if (hono !== null) return hono;
      hono = await createServer(serverEnv);
      rawServerFetch = serveFetch((request) => hono!.fetch(request));
      return hono;
    },
    spawnClient(id, env = client(id)) {
      const existing = liveClients.get(id);
      if (existing !== undefined) return existing;
      const live = createClient(env);
      liveClients.set(id, live);
      return live;
    },
    async dropClient(id) {
      const live = liveClients.get(id);
      if (live === undefined) return;
      liveClients.delete(id);
      try {
        await live.close();
      } catch {
        // already closed
      }
    },
    clientIds: () => [...liveClients.keys()],
    bumpClientEpoch: () => {
      bumpSimClientEpoch();
    },
    crash: (id) => {
      net.crash(id);
    },
    restart: (id) => {
      net.restart(id);
    },
    partition: (a, b) => {
      net.partition(a, b);
    },
    heal: (a, b) => {
      net.heal(a, b);
    },
    dispose: () =>
      disposeSim({ disposed, liveClients, roomNode, clientSql, serverSql }),
    roomNode,
    serverSql,
    clientSql: (id) => clientSql.get(id),
  };
}

/**
 * Playground + openSim fabric. Production never calls this.
 */
export async function createSim(opts?: CreateSimOptions): Promise<Sim> {
  const kernel = await bootSimKernel(opts);
  return createSimHandle(kernel);
}
