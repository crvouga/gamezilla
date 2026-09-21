import type { ClientEnv } from '@libs/client-app/shell/client-env';
import {
  type Client,
  createClient,
} from '@libs/client-app/shell/create-client';
import {
  SIM_AUTH_SECRET,
  SIM_GOOGLE_CLIENT_ID,
  SIM_GOOGLE_CLIENT_SECRET,
  SIM_IDP_URL,
  SIM_SERVER_URL,
} from '@libs/feature/public/sim-constants';
import type { EnvTime } from '@libs/feature/public/sync';
import type { ServerEnv } from '@libs/server-app';
import { loadAuthBootConfig } from '@libs/server-app/config/auth-boot';
import { assert } from '@pkgs/assert';
import type { MembershipBilling } from '@pkgs/billing';
import type { Clock, Timers } from '@pkgs/clock';
import type { GoogleIdp } from '@pkgs/idp-google-sim/server';
import { KvImplInMemory } from '@pkgs/kv/impl-in-memory';
import { InMemoryLlmProvider } from '@pkgs/llm/server';
import { createLogger } from '@pkgs/logger';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import { createNoopObservability } from '@pkgs/observability/impl-noop/impl-noop';
import {
  createInMemoryBus,
  createInMemoryPubSub,
} from '@pkgs/pubsub/in-memory';
import { createRecordSecretStore } from '@pkgs/secret-store/record-secret-store';
import type { Session } from '@pkgs/sim';
import { InMemoryTtsProvider } from '@pkgs/tts/server';
import {
  noRoomNode,
  type SimComposition,
  type SimRoomNode,
} from '../composition';
import { compositionMigratePostgres } from '../migrate/migrate-composition';
import {
  openSimBillingNode,
  SIM_BILLING_ID,
  type SimBillingProvider,
  simMembershipBilling,
} from './sim-billing';
import type { SimBrowser } from './sim-browser';
import { makeSimClientEnv } from './sim-client-env';
import { bumpSimClientEpoch } from './sim-client-namespace';
import { createSimIdp, simIdpEmail, simIdpFetchFrom } from './sim-idp';
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
  openFreshSimClientSql,
  openFreshSimServerSql,
  openSimServerSqlFromSeedBytes,
  type SimSql,
  sharedSqlClient,
} from './sim-sql';

/** Placeholder DATABASE_URL for secret-store / config (no TCP listener). */
const SIM_POSTGRES_MEM_DATABASE_URL = 'postgresql://postgres-mem/sim';

export type CreateSimOptions = {
  /** The features this sim boots. */
  readonly composition: SimComposition;
  /** Override virtual timers (hosts that need wall timers for a live UI). */
  readonly timers?: Timers;
  /** Real-mode host injects embedded Postgres; product-simulator uses sqlBackend server SQL. */
  readonly serverSql?: SimSql;
  /**
   * Post-migrate server seed bytes (PGMM). When set (and
   * `serverSql` is not), opens by import and skips the composition's migrate.
   */
  readonly serverSqlSeedBytes?: Uint8Array;
};

type UnderlyingScheduler = Session['scheduler']['underlying'];

export type Sim = {
  readonly session: Session;
  readonly composition: SimComposition;
  /** Primary instance env — the `clock` / `timers` / `createId` the console uses. */
  readonly server: ServerEnv;
  readonly clock: Clock;
  readonly scheduler: UnderlyingScheduler;
  readonly pubSubBus: ReturnType<typeof createInMemoryBus>;
  /** Crash / partition coordinator for in-process + localhost HTTP hosts. */
  readonly net: ReturnType<typeof createSimNet>;
  /** Round-robin ingress every client talks to. */
  readonly loadBalancer: SimLoadBalancer;
  /** The simulated Google the product signs in against. */
  readonly idp: GoogleIdp;
  /** The payment provider node, when the composition sells something. */
  readonly billing: SimBillingProvider | null;
  /** Auth directory entry + env; the account row is written on first use. */
  client(id: string): Promise<ClientEnv>;
  /** The actor's web browser (sign-in window, billing pages). */
  browser(id: string): SimBrowser;
  /** Boot an API instance. Default ids are `server-a`, `server-b`, … */
  spawnServer(id?: string): Promise<Server>;
  /** Remove an API instance from the balancer rotation. */
  dropServer(id: string): Promise<void>;
  serverIds(): readonly string[];
  serverEnv(id: string): ServerEnv | undefined;
  spawnClient(id: string, env?: ClientEnv): Promise<Client>;
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
  /** The in-process room host (empty when the composition runs no rooms). */
  readonly roomNode: SimRoomNode;
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
  readonly tts: ServerEnv['tts'];
  readonly llm: ServerEnv['llm'];
  readonly secrets: ServerEnv['secrets'];
  readonly auth: ServerEnv['auth'];
  readonly sqlClient: Awaited<ReturnType<ServerEnv['openSqlClient']>>;
};

async function buildSharedServerServices(
  serverSql: SimSql
): Promise<SharedServerServices> {
  const secrets = createRecordSecretStore({
    AUTH_SECRET: SIM_AUTH_SECRET,
    DATABASE_URL: SIM_POSTGRES_MEM_DATABASE_URL,
    API_URL: SIM_SERVER_URL,
    WEB_CLIENT_GOOGLE_CLIENT_ID: SIM_GOOGLE_CLIENT_ID,
    WEB_CLIENT_GOOGLE_CLIENT_SECRET: SIM_GOOGLE_CLIENT_SECRET,
  });
  return {
    kv: new KvImplInMemory(),
    blob: new ObjectStoreImplInMemory(),
    tts: new InMemoryTtsProvider(),
    llm: new InMemoryLlmProvider(),
    secrets,
    auth: await loadAuthBootConfig({
      secretStore: secrets,
      apiUrlOverride: SIM_SERVER_URL,
      googleIdpOrigin: SIM_IDP_URL,
    }),
    sqlClient: sharedSqlClient(serverSql.sqlClient),
  };
}

type ServerEnvDeps = {
  readonly id: string;
  readonly session: Session;
  readonly seed: bigint;
  readonly timers: Timers;
  readonly shared: SharedServerServices;
  readonly pubSubBus: ReturnType<typeof createInMemoryBus>;
  /** Outbound vendor HTTP: only the provider node is reachable. */
  readonly vendorFetch: ServerEnv['fetch'];
  /** This instance's membership adapter, or `null` when nothing is sold. */
  readonly billing: MembershipBilling | null;
};

function buildServerEnv(args: ServerEnvDeps): ServerEnv {
  const { id, session, seed, timers, shared, pubSubBus } = args;
  return {
    clock: session.ports.clock,
    timers,
    createId: session.ports.createId,
    random: session.ports.random,
    seed,
    openSqlClient: () => Promise.resolve(shared.sqlClient),
    events: createInMemoryPubSub({
      bus: pubSubBus,
      logger: createLogger({
        name: `sim-${id}:pubsub`,
        now: () => session.ports.clock.now(),
      }),
    }),
    kv: shared.kv,
    blob: shared.blob,
    billing: args.billing,
    tts: shared.tts,
    llm: shared.llm,
    secrets: shared.secrets,
    observability: createNoopObservability(`sim-${id}`),
    auth: shared.auth,
    secretsEnv: 'dev',
    serverUrl: SIM_SERVER_URL,
    skipDatabaseUrlPolicy: true,
    fetch: args.vendorFetch,
  };
}

function buildRoomServerEnv(args: {
  readonly session: Session;
  readonly seed: bigint;
  readonly timers: Timers;
}): EnvTime {
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
  readonly composition: SimComposition;
  readonly idp: GoogleIdp;
  readonly idpSql: SimSql;
  readonly billing: SimBillingProvider | null;
  readonly billingSql: SimSql | null;
  readonly seed: bigint;
  readonly timers: Timers;
  readonly net: ReturnType<typeof createSimNet>;
  readonly pubSubBus: ReturnType<typeof createInMemoryBus>;
  readonly serverSql: SimSql;
  readonly roomNode: SimRoomNode;
  readonly servers: SimServerNodes;
  readonly loadBalancer: SimLoadBalancer;
  readonly primaryEnv: ServerEnv;
  readonly disposed: { value: boolean };
};

async function openServerSql(
  session: Session,
  opts: CreateSimOptions
): Promise<SimSql> {
  const clock = session.ports.clock;
  if (opts.serverSql !== undefined) return opts.serverSql;
  const fromPorts = portSql(session);
  if (fromPorts !== undefined) return fromPorts;
  if (opts.serverSqlSeedBytes !== undefined) {
    return openSimServerSqlFromSeedBytes(
      'sim_server',
      clock,
      opts.serverSqlSeedBytes
    );
  }
  const serverSql = await openFreshSimServerSql('sim_server', clock);
  const pool = serverSql.pool;
  assert.defined(pool, 'createSim: server handle requires pool for migrate');
  await compositionMigratePostgres(opts.composition)({
    sqlClient: serverSql.sqlClient,
    pool,
    now: clock.now,
  });
  return serverSql;
}

async function bootSimKernel(
  session: Session,
  opts: CreateSimOptions
): Promise<SimKernel> {
  const { composition } = opts;
  const seed = sessionSeed(session);
  const timers = opts.timers ?? session.ports.timers;
  const net = createSimNet({
    isPartitioned: (a, b) => session.network.isPartitioned(a, b),
  });
  const pubSubBus = createInMemoryBus();
  const idpSql = await openFreshSimClientSql('sim_idp', session.ports.clock);
  const idp = await createSimIdp({
    clock: session.ports.clock,
    createId: session.ports.createId,
    sqlClient: idpSql.sqlClient,
  });
  const serverSql = await openServerSql(session, opts);
  const shared = await buildSharedServerServices(serverSql);
  const billingNode = await openSimBillingNode({
    offer: composition.billingOffer,
    clock: session.ports.clock,
    timers,
    createId: session.ports.createId,
    // Webhooks go through the balancer, like any caller's.
    toApi: () => loadBalancer.fetchFrom(SIM_BILLING_ID),
  });
  const billing = billingNode?.provider ?? null;
  const roomNode =
    composition.roomNode?.(buildRoomServerEnv({ session, seed, timers })) ??
    noRoomNode(composition.name);
  const disposed = { value: false };
  const servers = createSimServerNodes({
    composition,
    buildEnv: (id) =>
      Promise.resolve(
        buildServerEnv({
          id,
          session,
          seed,
          timers,
          shared,
          pubSubBus,
          vendorFetch: simIdpFetchFrom({ idp, net, from: id }),
          billing: simMembershipBilling({
            billing,
            net,
            from: id,
            clock: session.ports.clock,
          }),
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
    composition,
    idp,
    idpSql,
    billing,
    billingSql: billingNode?.sql ?? null,
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
  await kernel.idpSql.disconnect();
  await kernel.billingSql?.disconnect();
  await kernel.serverSql.disconnect();
}

/**
 * One env per client id for the sim lifetime — seeded `createId` must not
 * reset while `clientSql` still holds mutation rows from the prior stream.
 */
function createClientEnvs(
  kernel: SimKernel,
  clientSql: Map<string, SimSql>,
  browsers: Map<string, SimBrowser>
): (id: string) => Promise<ClientEnv> {
  const clientEnvs = new Map<string, ClientEnv>();
  const pendingEnvs = new Map<string, Promise<ClientEnv>>();
  return async (id) => {
    const cached = clientEnvs.get(id);
    if (cached !== undefined) return cached;
    const inFlight = pendingEnvs.get(id);
    if (inFlight !== undefined) return await inFlight;
    const pending = (async (): Promise<ClientEnv> => {
      // The person behind this actor needs a Google account to sign in with.
      await kernel.idp.addAccount({ handle: id, email: simIdpEmail(id) });
      const built = makeSimClientEnv(kernel, { id, clientSql });
      browsers.set(id, built.browser);
      clientEnvs.set(id, built.env);
      pendingEnvs.delete(id);
      return built.env;
    })();
    pendingEnvs.set(id, pending);
    return await pending;
  };
}

function createSimHandle(kernel: SimKernel): Sim {
  const { session, net, pubSubBus, serverSql, roomNode, servers, idp } = kernel;
  const clientSql = new Map<string, SimSql>();
  const browsers = new Map<string, SimBrowser>();
  const liveClients = new Map<string, Client>();
  const client = createClientEnvs(kernel, clientSql, browsers);
  return {
    session,
    composition: kernel.composition,
    server: kernel.primaryEnv,
    clock: session.ports.clock,
    scheduler: session.scheduler.underlying,
    pubSubBus,
    net,
    loadBalancer: kernel.loadBalancer,
    idp,
    billing: kernel.billing,
    client,
    browser: (id) => {
      const browser = browsers.get(id);
      assert.defined(browser, `sim browser missing for ${id}`);
      return browser;
    },
    async spawnServer(id) {
      const node = await servers.spawn(id);
      // A respawned instance must not stay marked down from a prior crash.
      net.restart(node.id);
      return node.app;
    },
    dropServer: (id) => servers.drop(id),
    serverIds: () => servers.ids(),
    serverEnv: (id) => servers.get(id)?.env,
    async spawnClient(id, env) {
      const existing = liveClients.get(id);
      if (existing !== undefined) return existing;
      const live = createClient(env ?? (await client(id)), {
        features: kernel.composition.clients,
        loadApp: () => Promise.resolve(kernel.composition.app),
      });
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
  opts: CreateSimOptions
): Promise<Sim> {
  bumpSimClientEpoch();
  const kernel = await bootSimKernel(session, opts);
  return createSimHandle(kernel);
}
