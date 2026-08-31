import { createInMemoryDevMenuPort } from '@apps/client/device/in-memory-dev-menu-port';
import { createInMemoryNetworkStatePort } from '@apps/client/device/in-memory-network-state-port';
import type { ClientEnv } from '@apps/client/product/client-env';
import { type Client, createClient } from '@apps/client/product/create-client';
import { SimGestureRoot } from '@apps/client/product/sim-gesture-root';
import {
  createRoomServer,
  type RoomServerApp,
} from '@apps/room-server/app/create-room-server';
import type { RoomServerEnv } from '@apps/room-server/app/room-server-env';
import { createServer, type ServerEnv, serveFetch } from '@apps/server';
import { loadAuthBootConfig } from '@apps/server/config/auth-boot';
import {
  migrateSimPostgres,
  SIM_AUTH_SECRET,
  SIM_POSTGRES_MEM_DATABASE_URL,
  SIM_SERVER_URL,
} from '@apps/server/sim/migrate-sim-postgres';
import { assert } from '@pkgs/assert';
import { createNamespacedAuthClientStorage } from '@pkgs/auth/client';
import { InMemoryBilling } from '@pkgs/billing';
import type { Timers } from '@pkgs/clock';
import {
  createSimDeps,
  type SimClock,
  type SimDeps,
  type SimScheduler,
} from '@pkgs/dst';
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
import { createInMemorySecureStorage } from '@pkgs/secure-storage/impl-memory';
import { createNamespacedWebSecureStorage } from '@pkgs/secure-storage/impl-web';
import { createSecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';
import { createInMemoryAudioPlaybackPort } from '@pkgs/sounds/audio-playback/in-memory-audio-playback-port';
import { InMemoryTtsProvider } from '@pkgs/tts/server';
import { createPassthroughBottomSheetHost } from '@pkgs/ui';
import { serializeFetch } from './sim-fetch';
import { createSimNet } from './sim-net';
import {
  handleBoundSqlClient,
  openFreshSimClientSql,
  openFreshSimServerSql,
  openSimServerSqlFromSeedBytes,
  type SimSqlHandle,
  sharedSqlClient,
} from './sim-sql';

function hasWebLocalStorage(): boolean {
  return typeof globalThis.localStorage !== 'undefined';
}

export type CreateSimOptions = {
  readonly seed?: number | bigint | string;
  readonly startMs?: number;
  /** Override virtual timers (openSim injects node timers for RNTL). */
  readonly timers?: Timers;
  /** Max-fidelity host injects embedded Postgres; playground uses fabric server SQL. */
  readonly serverSql?: SimSqlHandle;
  /**
   * Post-migrate server seed bytes (PGlite dump or PGMM). When set (and
   * `serverSql` is not), opens by import and skips {@link migrateSimPostgres}.
   */
  readonly serverSqlSeedBytes?: Uint8Array;
};

export type Server = Awaited<ReturnType<typeof createServer>>;

export type Sim = {
  readonly server: ServerEnv;
  readonly clock: SimClock;
  readonly scheduler: SimScheduler;
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
  readonly roomNode: RoomServerApp;
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
  readonly deps: SimDeps;
  readonly timers: Timers;
  readonly serverSql: SimSqlHandle;
  readonly pubSubBus: ReturnType<typeof createInMemoryBus>;
}): Promise<ServerEnv> {
  const { deps, timers, serverSql, pubSubBus } = args;
  const shared = sharedSqlClient(serverSql.sqlClient);
  const secrets = createRecordSecretStore({
    AUTH_SECRET: SIM_AUTH_SECRET,
    DATABASE_URL: SIM_POSTGRES_MEM_DATABASE_URL,
    API_URL: SIM_SERVER_URL,
  });
  const auth = await loadAuthBootConfig({
    secretStore: secrets,
    apiUrlOverride: SIM_SERVER_URL,
    secretsEnv: 'dev',
  });
  return {
    clock: deps.clock,
    timers,
    createId: deps.createId,
    random: deps.random,
    seed: deps.seed,
    openSqlClient: async () => shared,
    events: createInMemoryPubSub({ bus: pubSubBus }),
    kv: new KvImplInMemory(),
    blob: new ObjectStoreImplInMemory(),
    billing: new InMemoryBilling({ baseUrl: SIM_SERVER_URL }),
    tts: new InMemoryTtsProvider(),
    llm: new InMemoryLlmProvider(),
    secrets,
    observability: createNoopObservability('sim-server'),
    auth,
    secretsEnv: 'dev',
    serverUrl: SIM_SERVER_URL,
    skipDatabaseUrlPolicy: true,
    fetch: async () => {
      throw new Error('sim ServerEnv.fetch: vendor HTTP not configured');
    },
  };
}

function buildRoomServerEnv(args: {
  readonly deps: SimDeps;
  readonly timers: Timers;
}): RoomServerEnv {
  const { deps, timers } = args;
  return {
    clock: deps.clock,
    timers,
    createId: deps.createId,
    random: deps.random,
    seed: deps.seed,
  };
}

type SimKernel = {
  readonly deps: SimDeps;
  readonly timers: Timers;
  readonly net: ReturnType<typeof createSimNet>;
  readonly pubSubBus: ReturnType<typeof createInMemoryBus>;
  readonly serverSql: SimSqlHandle;
  readonly roomNode: RoomServerApp;
  readonly serverEnv: ServerEnv;
};

async function bootSimKernel(opts?: CreateSimOptions): Promise<SimKernel> {
  const deps = createSimDeps({
    seed: opts?.seed ?? 1,
    startMs: opts?.startMs ?? 0,
  });
  const timers = opts?.timers ?? deps.timers;
  const net = createSimNet();
  const pubSubBus = createInMemoryBus();
  let serverSql: SimSqlHandle;
  if (opts?.serverSql !== undefined) {
    serverSql = opts.serverSql;
  } else if (opts?.serverSqlSeedBytes !== undefined) {
    serverSql = await openSimServerSqlFromSeedBytes(
      'sim_server',
      deps.clock,
      opts.serverSqlSeedBytes
    );
  } else {
    serverSql = await openFreshSimServerSql('sim_server', deps.clock);
    const pool = serverSql.pool;
    assert.defined(pool, 'createSim: server handle requires pool for migrate');
    await migrateSimPostgres({
      sqlClient: serverSql.sqlClient,
      pool,
      now: deps.clock.now,
    });
  }
  const roomServerEnv = buildRoomServerEnv({ deps, timers });
  const roomNode = createRoomServer(roomServerEnv);
  const serverEnv = await buildServerEnv({
    deps,
    timers,
    serverSql,
    pubSubBus,
  });
  return { deps, timers, net, pubSubBus, serverSql, roomNode, serverEnv };
}

function makeSimClientEnv(
  kernel: SimKernel,
  args: {
    readonly id: string;
    readonly serverFetch: ClientEnv['server'];
    readonly clientSql: Map<string, SimSqlHandle>;
  }
): ClientEnv {
  const { deps, timers, net, pubSubBus, roomNode } = kernel;
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
    clock: deps.clock,
    timers,
    createId: deps.createId,
    random: deps.random,
    seed: deps.seed,
    server: net.wrapServerHttp(id, serverFetch),
    get events() {
      assert.defined(liveEvents, 'sim client events');
      return liveEvents;
    },
    createPubSub,
    openSqlClient: async () => {
      let handle = clientSql.get(id);
      if (handle === undefined) {
        handle = await openFreshSimClientSql(`sim_client_${id}`, deps.clock);
        clientSql.set(id, handle);
      }
      return handleBoundSqlClient(handle);
    },
    kv: hasWebLocalStorage()
      ? new KvImplWebNamespaced(ns)
      : new KvImplInMemory(),
    authStorage: createNamespacedAuthClientStorage(ns),
    secureStorage: createSecureStorageStore(
      hasWebLocalStorage()
        ? createNamespacedWebSecureStorage(ns)
        : createInMemorySecureStorage()
    ),
    room: (roomArgs) => {
      net.assertReachable(id, 'server');
      return roomNode.createTransport(roomArgs);
    },
    network: createInMemoryNetworkStatePort(),
    audio: createInMemoryAudioPlaybackPort(),
    devMenu: createInMemoryDevMenuPort(),
    gestureRoot: SimGestureRoot,
    bottomSheetHost: createPassthroughBottomSheetHost(),
    observability: createNoopObservability(`sim-client:${id}`),
    serverUrl: SIM_SERVER_URL,
    authBaseURL: SIM_SERVER_URL,
    resolveDatabaseName: () => ns,
    mutationSuccessHoldMs: 0,
  };
}

async function disposeSim(args: {
  disposed: { value: boolean };
  liveClients: Map<string, Client>;
  roomNode: RoomServerApp;
  clientSql: Map<string, SimSqlHandle>;
  serverSql: SimSqlHandle;
  /** Wait for in-flight Hono work before closing the DB. */
  drainServerFetch: () => Promise<void>;
  /** Drop HTTP after clients close so late auth cannot hit a closed DB. */
  stopServerFetch: () => void;
}): Promise<void> {
  if (args.disposed.value) return;
  args.disposed.value = true;
  // Close clients first so AuthBridge / session refresh stop scheduling work.
  for (const live of args.liveClients.values()) await live.close();
  args.liveClients.clear();
  await args.drainServerFetch();
  args.stopServerFetch();
  args.roomNode.dispose();
  for (const handle of args.clientSql.values()) await handle.disconnect();
  args.clientSql.clear();
  await args.serverSql.disconnect();
}

function createSimHandle(kernel: SimKernel): Sim {
  const { deps, net, pubSubBus, serverSql, roomNode, serverEnv } = kernel;
  const clientSql = new Map<string, SimSqlHandle>();
  const liveClients = new Map<string, Client>();
  const disposed = { value: false };
  let rawServerFetch: ReturnType<typeof serveFetch> | null = null;
  let hono: Server | null = null;
  const serialized = serializeFetch(async (input, init) => {
    if (disposed.value || rawServerFetch === null) {
      throw new Error('createSim: server disposed or not spawned');
    }
    return rawServerFetch(input, init);
  });
  const serverFetch: ClientEnv['server'] = serialized.fetch;
  const client = (id: string): ClientEnv =>
    makeSimClientEnv(kernel, { id, serverFetch, clientSql });
  return {
    server: serverEnv,
    clock: deps.clock,
    scheduler: deps.scheduler,
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
      disposeSim({
        disposed,
        liveClients,
        roomNode,
        clientSql,
        serverSql,
        drainServerFetch: serialized.drain,
        stopServerFetch: () => {
          rawServerFetch = null;
          hono = null;
        },
      }),
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
