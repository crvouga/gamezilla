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
import { setPendingSignupUsername } from '@libs/auth/public/pending-signup-username';
import { assert } from '@pkgs/assert';
import {
  createInProcessOpenAuthSession,
  createNamespacedAuthClientStorage,
} from '@pkgs/auth/client';
import { AUTH_NATIVE_SSO_CALLBACK_URL } from '@pkgs/auth/shared';
import { InMemoryBilling } from '@pkgs/billing';
import type { Clock, Timers } from '@pkgs/clock';
import { KvImplInMemory } from '@pkgs/kv/impl-in-memory';
import { KvImplWebNamespaced } from '@pkgs/kv-web/impl-kv-web-namespaced';
import { InMemoryLlmProvider } from '@pkgs/llm/server';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import { createNoopObservability } from '@pkgs/observability/impl-noop/impl-noop';
import {
  createInMemoryBus,
  createInMemoryPubSub,
} from '@pkgs/pubsub/in-memory';
import { createRecordSecretStore } from '@pkgs/secret-store/record-secret-store';
import { createInMemorySecureStorage } from '@pkgs/secure-storage/impl-memory';
import { createSecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';
import { createNamespacedWebSecureStorage } from '@pkgs/secure-storage-web';
import type { Session } from '@pkgs/sim';
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
  type SimSql,
  sharedSqlClient,
} from './sim-sql';

function hasWebLocalStorage(): boolean {
  return typeof globalThis.localStorage !== 'undefined';
}

export type CreateSimOptions = {
  /** Override virtual timers (openSim injects node timers for RNTL). */
  readonly timers?: Timers;
  /** Real-mode host injects embedded Postgres; playground uses sqlBackend server SQL. */
  readonly serverSql?: SimSql;
  /**
   * Post-migrate server seed bytes (PGMM). When set (and
   * `serverSql` is not), opens by import and skips {@link migrateSimPostgres}.
   */
  readonly serverSqlSeedBytes?: Uint8Array;
};

export type Server = Awaited<ReturnType<typeof createServer>>;

type UnderlyingScheduler = Session['scheduler']['underlying'];

export type Sim = {
  readonly session: Session;
  readonly server: ServerEnv;
  readonly clock: Clock;
  readonly scheduler: UnderlyingScheduler;
  readonly pubSubBus: ReturnType<typeof createInMemoryBus>;
  /** Crash / partition coordinator for in-process + localhost HTTP hosts. */
  readonly net: ReturnType<typeof createSimNet>;
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
  /**
   * Wait until every in-flight (and queued) in-process server HTTP request
   * settles. Virtual-time waits must call this after advancing so scripted
   * polls cannot burn their budget while serialized Hono is still draining.
   */
  drainServerFetch(): Promise<void>;
  dispose(): Promise<void>;
  readonly roomNode: RoomServerApp;
  readonly serverSql: SimSql;
  clientSql(id: string): SimSql | undefined;
};

let clientDurableEpoch = 0;

export function bumpSimClientEpoch(): number {
  clientDurableEpoch += 1;
  return clientDurableEpoch;
}

export function simClientNamespace(id: string): string {
  return `sim_client_${id}_e${clientDurableEpoch}`;
}

function sessionSeed(session: Session): bigint {
  const rng = session.ports.rng as {
    readonly _seeded?: { readonly seed: bigint };
  };
  return rng._seeded?.seed ?? 1n;
}

function portSql(session: Session): SimSql | undefined {
  return (session.ports as { readonly sql?: SimSql }).sql;
}

async function buildServerEnv(args: {
  readonly session: Session;
  readonly seed: bigint;
  readonly timers: Timers;
  readonly serverSql: SimSql;
  readonly pubSubBus: ReturnType<typeof createInMemoryBus>;
}): Promise<ServerEnv> {
  const { session, seed, timers, serverSql, pubSubBus } = args;
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
    clock: session.ports.clock,
    timers,
    createId: session.ports.createId,
    random: session.ports.random,
    seed,
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
  readonly session: Session;
  readonly seed: bigint;
  readonly timers: Timers;
}): RoomServerEnv {
  const { session, seed, timers } = args;
  return {
    clock: session.ports.clock,
    timers,
    createId: session.ports.createId,
    random: session.ports.random,
    seed,
  };
}

type SimKernel = {
  readonly session: Session;
  readonly seed: bigint;
  readonly timers: Timers;
  readonly net: ReturnType<typeof createSimNet>;
  readonly pubSubBus: ReturnType<typeof createInMemoryBus>;
  readonly serverSql: SimSql;
  readonly roomNode: RoomServerApp;
  readonly serverEnv: ServerEnv;
};

async function openServerSql(
  session: Session,
  opts?: CreateSimOptions
): Promise<SimSql> {
  const clock = session.ports.clock;
  if (opts?.serverSql !== undefined) return opts.serverSql;
  const fromPorts = portSql(session);
  if (fromPorts !== undefined) return fromPorts;
  if (opts?.serverSqlSeedBytes !== undefined) {
    return openSimServerSqlFromSeedBytes(
      'sim_server',
      clock,
      opts.serverSqlSeedBytes
    );
  }
  const serverSql = await openFreshSimServerSql('sim_server', clock);
  const pool = serverSql.pool;
  assert.defined(pool, 'createSim: server handle requires pool for migrate');
  await migrateSimPostgres({
    sqlClient: serverSql.sqlClient,
    pool,
    now: clock.now,
  });
  return serverSql;
}

async function bootSimKernel(
  session: Session,
  opts?: CreateSimOptions
): Promise<SimKernel> {
  const seed = sessionSeed(session);
  const timers = opts?.timers ?? session.ports.timers;
  const net = createSimNet({
    isPartitioned: (a, b) => session.network.isPartitioned(a, b),
  });
  const pubSubBus = createInMemoryBus();
  const serverSql = await openServerSql(session, opts);
  const roomServerEnv = buildRoomServerEnv({ session, seed, timers });
  const roomNode = createRoomServer(roomServerEnv);
  const serverEnv = await buildServerEnv({
    session,
    seed,
    timers,
    serverSql,
    pubSubBus,
  });
  return {
    session,
    seed,
    timers,
    net,
    pubSubBus,
    serverSql,
    roomNode,
    serverEnv,
  };
}

function makeSimClientEnv(
  kernel: SimKernel,
  args: {
    readonly id: string;
    readonly serverFetch: ClientEnv['server'];
    readonly clientSql: Map<string, SimSql>;
  }
): ClientEnv {
  const { session, seed, timers, net, pubSubBus, roomNode } = kernel;
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
    clock: session.ports.clock,
    timers,
    createId: session.ports.createId,
    random: session.ports.random,
    seed,
    server: net.wrapServerHttp(id, serverFetch),
    get events() {
      assert.defined(liveEvents, 'sim client events');
      return liveEvents;
    },
    createPubSub,
    openSqlClient: async () => {
      let handle = clientSql.get(id);
      if (handle === undefined) {
        handle = await openFreshSimClientSql(
          `sim_client_${id}`,
          session.ports.clock
        );
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
    authCallbackUrl: AUTH_NATIVE_SSO_CALLBACK_URL,
    openAuthSession: (() => {
      const completeDevAuth = createInProcessOpenAuthSession({
        fetch: (input, init) =>
          net.wrapServerHttp(id, serverFetch)(input, init),
        subject: id,
      });
      return async (authorizationUrl, callbackUrl) => {
        const result = await completeDevAuth(authorizationUrl, callbackUrl);
        if (result.type === 'success') {
          // Dev IdP subject doubles as the sim actor username (alice/bob).
          setPendingSignupUsername(id);
        }
        return result;
      };
    })(),
    resolveDatabaseName: () => ns,
    mutationSuccessHoldMs: 900,
  };
}

async function disposeSim(args: {
  disposed: { value: boolean };
  liveClients: Map<string, Client>;
  roomNode: RoomServerApp;
  clientSql: Map<string, SimSql>;
  serverSql: SimSql;
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
  const { session, net, pubSubBus, serverSql, roomNode, serverEnv } = kernel;
  const clientSql = new Map<string, SimSql>();
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
    session,
    server: serverEnv,
    clock: session.ports.clock,
    scheduler: session.scheduler.underlying,
    pubSubBus,
    net,
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
    drainServerFetch: () => serialized.drain(),
    dispose: async () => {
      await disposeSim({
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
      });
    },
    roomNode,
    serverSql,
    clientSql: (id) => clientSql.get(id),
  };
}

/**
 * Playground + openSim fabric. Production never calls this.
 * Caller opens a {@link Session} (`virtualTimeRuntime` / `realTimeRuntime` / product host).
 */
export async function createSim(
  session: Session,
  opts?: CreateSimOptions
): Promise<Sim> {
  const kernel = await bootSimKernel(session, opts);
  return createSimHandle(kernel);
}
