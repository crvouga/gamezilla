import type { ClientEnv } from '@apps/client/shell/client-env';
import { type Client, createClient } from '@apps/client/shell/create-client';
import {
  createRoomServer,
  type RoomServerApp,
} from '@apps/room-server/app/create-room-server';
import type { RoomServerEnv } from '@apps/room-server/app/room-server-env';
import type { ServerEnv } from '@apps/server';
import { loadAuthBootConfig } from '@apps/server/config/auth-boot';
import {
  migrateSimPostgres,
  SIM_AUTH_SECRET,
  SIM_POSTGRES_MEM_DATABASE_URL,
  SIM_SERVER_URL,
} from '@apps/server/sim/migrate-sim-postgres';
import { assert } from '@pkgs/assert';
import { InMemoryBilling } from '@pkgs/billing';
import type { Clock, Timers } from '@pkgs/clock';
import { KvImplInMemory } from '@pkgs/kv/impl-in-memory';
import { InMemoryLlmProvider } from '@pkgs/llm/server';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import { createLoggerObservability } from '@pkgs/observability/impl-logger/impl-logger';
import { createAsyncLocalSpanContextStorage } from '@pkgs/observability/server/context-storage';
import {
  createInMemoryBus,
  createInMemoryPubSub,
} from '@pkgs/pubsub/in-memory';
import { createRecordSecretStore } from '@pkgs/secret-store/record-secret-store';
import type { Session } from '@pkgs/sim';
import { InMemoryTtsProvider } from '@pkgs/tts/server';
import { createSeededCreateId, createSeededRng } from '@pkgs/uuid';
import { makeSimClientEnv } from './sim-client-env';
import { bumpSimClientEpoch } from './sim-client-namespace';
import {
  createSimLoadBalancer,
  type SimLoadBalancer,
} from './sim-load-balancer';
import { createSimNet } from './sim-net';
import {
  createSimServerNodes,
  type Server,
  SIM_PRIMARY_SERVER_ID,
  type SimServerNodes,
} from './sim-server-nodes';
import {
  openFreshSimServerSql,
  openSimServerSqlFromSeedBytes,
  type SimSql,
  sharedSqlClient,
} from './sim-sql';

export type CreateSimOptions = {
  /** Override virtual timers (hosts that need wall timers for a live UI). */
  readonly timers?: Timers;
  /** Real-mode host injects embedded Postgres; product-simulator uses sqlBackend server SQL. */
  readonly serverSql?: SimSql;
  /** Public API origin presented to browser actors on a localhost profile. */
  readonly serverUrl?: string;
  readonly serverServices?: LocalhostServerServices;
  /**
   * Post-migrate server seed bytes (PGMM). When set (and
   * `serverSql` is not), opens by import and skips {@link migrateSimPostgres}.
   */
  readonly serverSqlSeedBytes?: Uint8Array;
};

/** Vendor ports supplied by the localhost composition root. */
export type LocalhostServerServices = Pick<
  ServerEnv,
  'billing' | 'blob' | 'secrets' | 'auth' | 'tts' | 'llm' | 'fetch'
> & { readonly createEvents: () => ServerEnv['events'] };

type UnderlyingScheduler = Session['scheduler']['underlying'];

export type Sim = {
  readonly session: Session;
  /** Primary instance env — the `clock` / `timers` / `createId` the console uses. */
  readonly server: ServerEnv;
  readonly clock: Clock;
  readonly scheduler: UnderlyingScheduler;
  readonly pubSubBus: ReturnType<typeof createInMemoryBus>;
  /** Crash / partition coordinator for in-process + localhost HTTP hosts. */
  readonly net: ReturnType<typeof createSimNet>;
  /** Round-robin ingress every client talks to. */
  readonly loadBalancer: SimLoadBalancer;
  client(id: string): ClientEnv;
  /** Boot an API instance. Default ids are `server-a`, `server-b`, … */
  spawnServer(id?: string): Promise<Server>;
  /** Remove an API instance from the balancer rotation. */
  dropServer(id: string): Promise<void>;
  serverIds(): readonly string[];
  serverEnv(id: string): ServerEnv | undefined;
  spawnClient(id: string, env?: ClientEnv): Client;
  dropClient(id: string): Promise<void>;
  clientIds(): readonly string[];
  bumpClientEpoch(): void;
  /** `'lb'`, a server instance id, or a client id. */
  crash(id: string): void;
  restart(id: string): void;
  partition(a: string, b: string): void;
  heal(a?: string, b?: string): void;
  /**
   * Wait until every in-flight (and queued) in-process server HTTP request
   * settles, across all instances. Virtual-time waits must call this after
   * advancing so scripted polls cannot burn their budget while serialized
   * Hono is still draining.
   */
  drainServerFetch(): Promise<void>;
  dispose(): Promise<void>;
  readonly roomNode: RoomServerApp;
  readonly serverSql: SimSql;
  clientSql(id: string): SimSql | undefined;
};

function sessionSeed(session: Session): bigint {
  const rng = session.ports.rng as {
    readonly _seeded?: { readonly seed: bigint };
  };
  return rng._seeded?.seed ?? 1n;
}

function portSql(session: Session): SimSql | undefined {
  return (session.ports as { readonly sql?: SimSql }).sql;
}

/**
 * Services a production fleet shares across API instances. Per-instance copies
 * would hide shared-state bugs (a Kv write on one instance must be visible on
 * the next request, whichever instance the balancer picks).
 */
type SharedServerServices = {
  readonly kv: ServerEnv['kv'];
  readonly blob: ServerEnv['blob'];
  readonly billing: ServerEnv['billing'];
  readonly tts: ServerEnv['tts'];
  readonly llm: ServerEnv['llm'];
  readonly secrets: ServerEnv['secrets'];
  readonly auth: ServerEnv['auth'];
  readonly sqlClient: Awaited<ReturnType<ServerEnv['openSqlClient']>>;
  readonly createEvents?: () => ServerEnv['events'];
};

async function buildSharedServerServices(
  serverSql: SimSql,
  serverUrl: string,
  live?: LocalhostServerServices
): Promise<SharedServerServices> {
  if (live !== undefined) {
    return {
      kv: new KvImplInMemory(),
      ...live,
      sqlClient: sharedSqlClient(serverSql.sqlClient),
    };
  }
  const secrets = createRecordSecretStore({
    AUTH_SECRET: SIM_AUTH_SECRET,
    DATABASE_URL: SIM_POSTGRES_MEM_DATABASE_URL,
    API_URL: serverUrl,
  });
  return {
    kv: new KvImplInMemory(),
    blob: new ObjectStoreImplInMemory(),
    billing: new InMemoryBilling({ baseUrl: serverUrl }),
    tts: new InMemoryTtsProvider(),
    llm: new InMemoryLlmProvider(),
    secrets,
    auth: await loadAuthBootConfig({
      secretStore: secrets,
      apiUrlOverride: serverUrl,
      enableDev: true,
    }),
    sqlClient: sharedSqlClient(serverSql.sqlClient),
  };
}

function buildServerEnv(args: {
  readonly id: string;
  readonly session: Session;
  readonly seed: bigint;
  readonly timers: Timers;
  readonly shared: SharedServerServices;
  readonly serverUrl: string;
  readonly fetch?: ServerEnv['fetch'];
  readonly pubSubBus: ReturnType<typeof createInMemoryBus>;
}): ServerEnv {
  const { id, session, seed, timers, shared, pubSubBus, serverUrl } = args;
  return {
    clock: session.ports.clock,
    timers,
    createId: session.ports.createId,
    random: session.ports.random,
    seed,
    openSqlClient: () => Promise.resolve(shared.sqlClient),
    events: shared.createEvents?.() ?? createInMemoryPubSub({ bus: pubSubBus }),
    kv: shared.kv,
    blob: shared.blob,
    billing: shared.billing,
    tts: shared.tts,
    llm: shared.llm,
    secrets: shared.secrets,
    observability: createLoggerObservability({
      serviceName: `sim-server:${id}`,
      now: session.ports.clock.now,
      createId: createSeededCreateId(
        createSeededRng(`${seed.toString()}:observability:server:${id}`).random
      ),
      storage: createAsyncLocalSpanContextStorage(),
    }),
    auth: shared.auth,
    secretsEnv: 'dev',
    serverUrl,
    skipDatabaseUrlPolicy: true,
    fetch:
      args.fetch ??
      (() =>
        Promise.reject(
          new Error('sim ServerEnv.fetch: vendor HTTP not configured')
        )),
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
  readonly servers: SimServerNodes;
  readonly loadBalancer: SimLoadBalancer;
  readonly primaryEnv: ServerEnv;
  readonly disposed: { value: boolean };
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
  const serverUrl = opts?.serverUrl ?? SIM_SERVER_URL;
  const shared = await buildSharedServerServices(
    serverSql,
    serverUrl,
    opts?.serverServices
  );
  const roomNode = createRoomServer(
    buildRoomServerEnv({ session, seed, timers })
  );
  const disposed = { value: false };
  const servers = createSimServerNodes({
    buildEnv: (id) =>
      Promise.resolve(
        buildServerEnv({
          id,
          session,
          seed,
          timers,
          shared,
          pubSubBus,
          serverUrl,
          ...(opts?.serverServices !== undefined
            ? { fetch: opts.serverServices.fetch }
            : {}),
        })
      ),
    disposed: () => disposed.value,
  });
  const loadBalancer = createSimLoadBalancer({
    net,
    now: () => session.ports.clock.now(),
    listBackends: () => servers.backends(),
  });
  return {
    session,
    seed,
    timers,
    net,
    pubSubBus,
    serverSql,
    roomNode,
    servers,
    loadBalancer,
    primaryEnv: await servers.ensureEnv(SIM_PRIMARY_SERVER_ID),
    disposed,
  };
}

async function disposeSim(args: {
  readonly kernel: SimKernel;
  readonly liveClients: Map<string, Client>;
  readonly clientSql: Map<string, SimSql>;
}): Promise<void> {
  const { kernel } = args;
  if (kernel.disposed.value) return;
  // Close clients first so AuthBridge / session refresh stop scheduling work.
  for (const live of args.liveClients.values()) await live.close();
  args.liveClients.clear();
  await kernel.servers.drainAll();
  // Drop HTTP after clients close so late auth cannot hit a closed DB.
  kernel.disposed.value = true;
  kernel.servers.stopAll();
  kernel.roomNode.dispose();
  for (const handle of args.clientSql.values()) await handle.disconnect();
  args.clientSql.clear();
  await kernel.serverSql.disconnect();
}

function createSimHandle(kernel: SimKernel): Sim {
  const { session, net, pubSubBus, serverSql, roomNode, servers } = kernel;
  const clientSql = new Map<string, SimSql>();
  /** One env per id for the sim lifetime — seeded `createId` must not reset
   * while `clientSql` still holds mutation rows from the prior stream. */
  const clientEnvs = new Map<string, ClientEnv>();
  const liveClients = new Map<string, Client>();
  const client = (id: string): ClientEnv => {
    const cached = clientEnvs.get(id);
    if (cached !== undefined) return cached;
    const env = makeSimClientEnv(kernel, { id, clientSql });
    clientEnvs.set(id, env);
    return env;
  };
  return {
    session,
    server: kernel.primaryEnv,
    clock: session.ports.clock,
    scheduler: session.scheduler.underlying,
    pubSubBus,
    net,
    loadBalancer: kernel.loadBalancer,
    client,
    async spawnServer(id) {
      const node = await servers.spawn(id);
      // A respawned instance must not stay marked down from a prior crash.
      net.restart(node.id);
      return node.app;
    },
    dropServer: (id) => servers.drop(id),
    serverIds: () => servers.ids(),
    serverEnv: (id) => servers.get(id)?.env,
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
    drainServerFetch: () => servers.drainAll(),
    dispose: async () => {
      clientEnvs.clear();
      await disposeSim({ kernel, liveClients, clientSql });
    },
    roomNode,
    serverSql,
    clientSql: (id) => clientSql.get(id),
  };
}

/**
 * ProductSimulator + openSim fabric. Production never calls this.
 * Caller opens a {@link Session} (`virtualTimeRuntime` / `realTimeRuntime` / product host).
 *
 * Topology is dynamic: `spawnServer` / `dropServer` resize the API fleet behind
 * the round-robin balancer, `spawnClient` / `dropClient` resize the client set.
 *
 * Bumps the client durable epoch so each sim gets a fresh
 * `sim_client_${id}_eN` secure-storage / auth namespace. Without this, a prior
 * openSim that signed in leaves `sessionToken` under `e0` and the next guest
 * boot POSTs `/identity/refresh` against a dead JWT (fresh postgres-mem).
 */
export async function createSim(
  session: Session,
  opts?: CreateSimOptions
): Promise<Sim> {
  bumpSimClientEpoch();
  const kernel = await bootSimKernel(session, opts);
  return createSimHandle(kernel);
}
