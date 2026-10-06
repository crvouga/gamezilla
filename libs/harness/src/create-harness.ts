import type { ClientEnv } from '@libs/app-root-client/client-env';
import type { Client } from '@libs/app-root-client/create-client';
import { createClient } from '@libs/app-root-client/create-client';
import type { ServerEnv } from '@libs/app-root-shared/server-env';
import { HARNESS_SERVER_URL } from '@libs/feature-shared/harness-constants';
import { assert } from '@pkgs/assert-root-shared/singleton';
import { INHOUSE_AUTH_PROVIDER } from '@pkgs/auth-inhouse-server/inhouse-auth-provider';
import type { MembershipProviders } from '@pkgs/billing-root-shared/providers';
import type { Clock, Timers } from '@pkgs/clock-shared/types';
import type { Session } from '@pkgs/harness-root-shared/runtime-types';
import { KvImplInMemory } from '@pkgs/kv-root-shared/impl-in-memory';
import { InMemoryLlmProvider } from '@pkgs/llm-root-server/in-memory-llm-provider';
import { createLogger } from '@pkgs/logger-shared/logger';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared/impl-in-memory';
import type { OutboxConsumerRegistry } from '@pkgs/outbox-shared/define-consumer';
import {
  createInMemoryBus,
  createInMemoryPubSub,
} from '@pkgs/pubsub-root-shared/in-memory';
import { createRecordSecretStore } from '@pkgs/secret-store-shared/record-secret-store';
import type { MutationAuthorize } from '@pkgs/sync-engine-shared/mutations-types';
import { InMemoryTtsProvider } from '@pkgs/tts-root-server/in-memory-tts-provider';
import type { HarnessAccountReadyDelays } from './account-ready-delay';
import { createHarnessAccountReadyDelays } from './account-ready-delay';
import type { HarnessAppBuild, HarnessAppBuilds } from './app-build';
import { createHarnessAppBuilds } from './app-build';
import type { HarnessBillingProviders } from './billing';
import {
  harnessMembershipBilling,
  openHarnessBillingProviders,
} from './billing';
import type { HarnessBrowser } from './browser';
import { browserLookup } from './browser';
import { makeHarnessClientEnv } from './client-env';
import { createHarnessClientNamespaces } from './client-namespace';
import type { HarnessComposition, HarnessRoomNode } from './composition';
import type { AppleClientKeys, HarnessIdps } from './idp';
import {
  addHarnessIdpAccounts,
  createHarnessIdps,
  HARNESS_APPLE_IDP_ID,
  harnessAppleClientKeys,
  harnessIdpFetchFrom,
  harnessIdpSecrets,
} from './idp';
import type { HarnessLoadBalancer } from './load-balancer';
import { createHarnessLoadBalancer } from './load-balancer';
import { compositionMigratePostgres } from './migrate-composition';
import { createHarnessNet } from './net';
import { createHarnessRooms } from './room-services';
import type {
  HarnessServerNode,
  HarnessServerNodes,
  Server,
} from './server-nodes';
import {
  createHarnessServerNodes,
  HARNESS_PRIMARY_SERVER_ID,
} from './server-nodes';
import {
  openFreshHarnessServerSql,
  openHarnessServerSqlFromSeedBytes,
} from './sql';
import type { HarnessSql } from './sql-types';
import { sharedSqlClient } from './sql-types';
import type { HarnessTeamRules } from './team-rules';
import { createHarnessTeamRules } from './team-rules';

/** Placeholder DATABASE_URL for secret-store / config (no TCP listener). */
const HARNESS_MOCKINGBIRD_POSTGRES_DATABASE_URL =
  'postgresql://mockingbird-postgres/harness';

export type CreateHarnessOptions = {
  /** The features this harness boots. */
  readonly composition: HarnessComposition;
  /** Override virtual timers (hosts that need wall timers for a live UI). */
  readonly timers?: Timers;
  /** Real-mode host injects embedded Postgres; product-harness uses sqlBackend server SQL. */
  readonly serverSql?: HarnessSql;
  /**
   * Post-migrate server seed bytes (PGMM). When set (and
   * `serverSql` is not), opens by import and skips the composition's migrate.
   */
  readonly serverSqlSeedBytes?: Uint8Array;
};

type UnderlyingScheduler = Session['scheduler']['underlying'];

export type Harness = {
  readonly session: Session;
  readonly composition: HarnessComposition;
  /** Primary instance env — the `clock` / `timers` / `createId` the console uses. */
  readonly server: ServerEnv;
  readonly clock: Clock;
  readonly scheduler: UnderlyingScheduler;
  readonly pubSubBus: ReturnType<typeof createInMemoryBus>;
  /** Crash / partition coordinator for in-process + localhost HTTP hosts. */
  readonly net: ReturnType<typeof createHarnessNet>;
  /** Round-robin ingress every client talks to. */
  readonly loadBalancer: HarnessLoadBalancer;
  /** The simulated Google and Apple the product signs in against. */
  readonly idps: HarnessIdps;
  /** The payment providers, when the composition sells something. */
  readonly billing: HarnessBillingProviders | null;
  /** The team's moderation rules every device and API instance runs with. */
  readonly teamRules: HarnessTeamRules;
  /** Auth directory entry + env; the account row is written on first use. */
  client(id: string): Promise<ClientEnv>;
  clientNamespace(id: string): string;
  /** The actor's web browser (sign-in window, billing pages). */
  browser(id: string): HarnessBrowser;
  /** Boot an API instance. Default ids are `server-a`, `server-b`, … */
  spawnServer(id?: string): Promise<Server>;
  /** Remove an API instance from the balancer rotation. */
  dropServer(id: string): Promise<void>;
  serverIds(): readonly string[];
  serverEnv(id: string): ServerEnv | undefined;
  outboxConsumers(): OutboxConsumerRegistry;
  /** The primary API instance's server-only mutation checks. */
  authorizeServerMutation(): MutationAuthorize;
  spawnClient(id: string, env?: ClientEnv): Promise<Client>;
  dropClient(id: string): Promise<void>;
  clientIds(): readonly string[];
  bumpClientEpoch(): void;
  /** Put a device on an outdated or the current build of the app. */
  setAppBuild(id: string, build: HarnessAppBuild): void;
  /**
   * Hold a device's account-ready answer after sign-in (`/identity/refresh`)
   * for `delayMs` of harness time, as production's takes seconds. `0` clears.
   */
  setAccountReadyDelay(id: string, delayMs: number): void;
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
  readonly roomNode: HarnessRoomNode;
  readonly serverSql: HarnessSql;
  clientSql(id: string): HarnessSql | undefined;
};

function sessionSeed(session: Session): bigint {
  const rng = session.ports.rng as {
    readonly _seeded?: { readonly seed: bigint };
  };
  return rng._seeded?.seed ?? 1n;
}

function portSql(session: Session): HarnessSql | undefined {
  return (session.ports as { readonly sql?: HarnessSql }).sql;
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
  readonly moderation: ServerEnv['moderation'];
  readonly sqlClient: Awaited<ReturnType<ServerEnv['openSqlClient']>>;
};

function buildSharedServerServices(
  serverSql: HarnessSql,
  appleKeys: AppleClientKeys,
  auth: ServerEnv['auth'],
  moderation: ServerEnv['moderation']
): SharedServerServices {
  const secrets = createRecordSecretStore({
    DATABASE_URL: HARNESS_MOCKINGBIRD_POSTGRES_DATABASE_URL,
    API_URL: HARNESS_SERVER_URL,
    ...harnessIdpSecrets(appleKeys),
  });
  return {
    kv: new KvImplInMemory(),
    blob: new ObjectStoreImplInMemory(),
    tts: new InMemoryTtsProvider(),
    llm: new InMemoryLlmProvider(),
    secrets,
    // The simulated deployment signs in through the in-house IdP.
    auth,
    moderation,
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
  readonly billing: MembershipProviders | null;
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
        name: `harness-${id}:pubsub`,
        now: () => session.ports.clock.now(),
      }),
    }),
    kv: shared.kv,
    blob: shared.blob,
    reports: null,
    billing: args.billing,
    tts: shared.tts,
    llm: shared.llm,
    secrets: shared.secrets,
    auth: shared.auth,
    moderation: shared.moderation,
    protection: 'standard',
    serverUrl: HARNESS_SERVER_URL,
    skipDatabaseUrlPolicy: true,
    fetch: args.vendorFetch,
  };
}

type HarnessKernel = {
  readonly session: Session;
  readonly composition: HarnessComposition;
  readonly idps: HarnessIdps;
  readonly billing: HarnessBillingProviders | null;
  readonly teamRules: HarnessTeamRules;
  readonly seed: bigint;
  readonly timers: Timers;
  readonly net: ReturnType<typeof createHarnessNet>;
  readonly pubSubBus: ReturnType<typeof createInMemoryBus>;
  readonly serverSql: HarnessSql;
  readonly roomNode: HarnessRoomNode;
  readonly servers: HarnessServerNodes;
  readonly loadBalancer: HarnessLoadBalancer;
  readonly primaryEnv: ServerEnv;
  readonly appBuilds: HarnessAppBuilds;
  readonly accountReadyDelays: HarnessAccountReadyDelays;
  readonly disposed: { value: boolean };
};

async function openServerSql(
  session: Session,
  opts: CreateHarnessOptions
): Promise<HarnessSql> {
  const clock = session.ports.clock;
  if (opts.serverSql !== undefined) return opts.serverSql;
  const fromPorts = portSql(session);
  if (fromPorts !== undefined) return fromPorts;
  if (opts.serverSqlSeedBytes !== undefined) {
    return openHarnessServerSqlFromSeedBytes(
      'harness_server',
      clock,
      opts.serverSqlSeedBytes
    );
  }
  const serverSql = await openFreshHarnessServerSql('harness_server', clock);
  const pool = serverSql.pool;
  assert.defined(
    pool,
    'createHarness: server handle requires pool for migrate'
  );
  await compositionMigratePostgres(opts.composition)({
    sqlClient: serverSql.sqlClient,
    pool,
    now: clock.now,
  });
  return serverSql;
}

/** Each API instance's env, wired to this deployment's shared services. */
function serverEnvBuilder(deps: {
  readonly session: Session;
  readonly seed: bigint;
  readonly timers: Timers;
  readonly shared: SharedServerServices;
  readonly pubSubBus: ReturnType<typeof createInMemoryBus>;
  readonly idps: HarnessIdps;
  readonly net: ReturnType<typeof createHarnessNet>;
  readonly billing: HarnessBillingProviders | null;
}): (id: string) => Promise<ServerEnv> {
  const { session, idps, net, billing } = deps;
  return (id) =>
    Promise.resolve(
      buildServerEnv({
        id,
        session,
        seed: deps.seed,
        timers: deps.timers,
        shared: deps.shared,
        pubSubBus: deps.pubSubBus,
        vendorFetch: harnessIdpFetchFrom({ idps, net, from: id }),
        billing: harnessMembershipBilling({
          billing,
          net,
          from: id,
          clock: session.ports.clock,
        }),
      })
    );
}

async function bootHarnessKernel(
  session: Session,
  opts: CreateHarnessOptions
): Promise<HarnessKernel> {
  const { composition } = opts;
  const seed = sessionSeed(session);
  const timers = opts.timers ?? session.ports.timers;
  const net = createHarnessNet({
    isPartitioned: (a, b) => session.network.isPartitioned(a, b),
  });
  const pubSubBus = createInMemoryBus();
  const appleKeys = await harnessAppleClientKeys();
  const idps = createHarnessIdps({
    clock: session.ports.clock,
    appleKeys,
    toApi: () => loadBalancer.fetchFrom(HARNESS_APPLE_IDP_ID),
  });
  const serverSql = await openServerSql(session, opts);
  const teamRules = createHarnessTeamRules(session.ports.clock);
  const shared = buildSharedServerServices(
    serverSql,
    appleKeys,
    composition.authProvider ?? INHOUSE_AUTH_PROVIDER,
    teamRules.moderation
  );
  const billing = await openHarnessBillingProviders({
    offer: composition.billingOffer,
    clock: session.ports.clock,
    timers,
    // Webhooks go through the balancer, like any caller's.
    toApi: (node) => loadBalancer.fetchFrom(node),
  });
  const { roomNode, rooms } = createHarnessRooms({
    session,
    composition,
    seed,
    timers,
    serverSql,
  });
  const disposed = { value: false };
  const servers = createHarnessServerNodes({
    composition,
    rooms,
    buildEnv: serverEnvBuilder({
      session,
      seed,
      timers,
      shared,
      pubSubBus,
      idps,
      net,
      billing,
    }),
    disposed: () => disposed.value,
  });
  const loadBalancer = createHarnessLoadBalancer({
    net,
    now: () => session.ports.clock.now(),
    listBackends: () => servers.backends(),
  });
  return {
    session,
    composition,
    idps,
    billing,
    teamRules,
    seed,
    timers,
    net,
    pubSubBus,
    serverSql,
    roomNode,
    servers,
    loadBalancer,
    primaryEnv: await servers.ensureEnv(HARNESS_PRIMARY_SERVER_ID),
    appBuilds: createHarnessAppBuilds(),
    accountReadyDelays: createHarnessAccountReadyDelays(),
    disposed,
  };
}

async function disposeHarness(args: {
  readonly kernel: HarnessKernel;
  readonly liveClients: Map<string, Client>;
  readonly clientSql: Map<string, HarnessSql>;
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
  await kernel.billing?.dispose();
  await kernel.serverSql.disconnect();
}

/**
 * One env per client id for the harness lifetime — seeded `createId` must not
 * reset while `clientSql` still holds mutation rows from the prior stream.
 */
function createClientEnvs(
  kernel: HarnessKernel,
  clientSql: Map<string, HarnessSql>,
  browsers: Map<string, HarnessBrowser>,
  clientNamespace: (id: string) => string
): (id: string) => Promise<ClientEnv> {
  const clientEnvs = new Map<string, ClientEnv>();
  return (id) => {
    const namespace = clientNamespace(id);
    const cached = clientEnvs.get(namespace);
    if (cached !== undefined) return Promise.resolve(cached);
    // The person behind this actor holds accounts at both providers.
    addHarnessIdpAccounts(kernel.idps, id);
    const built = makeHarnessClientEnv(kernel, { id, clientSql, namespace });
    browsers.set(id, built.browser);
    clientEnvs.set(namespace, built.env);
    return Promise.resolve(built.env);
  };
}

function primaryServer(servers: HarnessServerNodes): HarnessServerNode {
  const node = servers.get(HARNESS_PRIMARY_SERVER_ID);
  if (node === undefined) throw new Error('primary server is missing');
  return node;
}

/** The API instances: spawn, drop and read them, and the primary's ports. */
function serverHandles(
  servers: HarnessServerNodes,
  net: HarnessKernel['net']
): Pick<
  Harness,
  | 'spawnServer'
  | 'dropServer'
  | 'serverIds'
  | 'serverEnv'
  | 'drainServerFetch'
  | 'outboxConsumers'
  | 'authorizeServerMutation'
> {
  return {
    async spawnServer(id) {
      const node = await servers.spawn(id);
      // A respawned instance must not stay marked down from a prior crash.
      net.restart(node.id);
      return node.app;
    },
    dropServer: (id) => servers.drop(id),
    serverIds: () => servers.ids(),
    serverEnv: (id) => servers.get(id)?.env,
    drainServerFetch: () => servers.drainAll(),
    outboxConsumers: () => primaryServer(servers).outboxConsumers,
    authorizeServerMutation: () => primaryServer(servers).authorizeMutation,
  };
}

function createHarnessHandle(kernel: HarnessKernel): Harness {
  const { session, net, pubSubBus, serverSql, roomNode, servers, idps } =
    kernel;
  const clientSql = new Map<string, HarnessSql>();
  const browsers = new Map<string, HarnessBrowser>();
  const liveClients = new Map<string, Client>();
  const namespaces = createHarnessClientNamespaces();
  const client = createClientEnvs(
    kernel,
    clientSql,
    browsers,
    namespaces.namespace
  );
  return {
    session,
    clientNamespace: namespaces.namespace,
    composition: kernel.composition,
    server: kernel.primaryEnv,
    clock: session.ports.clock,
    scheduler: session.scheduler.underlying,
    pubSubBus,
    net,
    loadBalancer: kernel.loadBalancer,
    idps,
    billing: kernel.billing,
    teamRules: kernel.teamRules,
    client,
    browser: browserLookup(browsers),
    ...serverHandles(servers, net),
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
    bumpClientEpoch: namespaces.bump,
    setAppBuild: (id, build) => kernel.appBuilds.set(id, build),
    setAccountReadyDelay: (id, delayMs) => {
      kernel.accountReadyDelays.set(id, delayMs);
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
    dispose: async () => {
      await disposeHarness({ kernel, liveClients, clientSql });
    },
    roomNode,
    serverSql,
    clientSql: (id) => clientSql.get(id),
  };
}

/**
 * ProductHarness + openHarness fabric. Production never calls this.
 * Caller opens a {@link Session} (`virtualTimeRuntime` / `realTimeRuntime` / product host).
 *
 * Topology is dynamic: `spawnServer` / `dropServer` resize the API fleet behind
 * the round-robin balancer, `spawnClient` / `dropClient` resize the client set.
 *
 * Bumps the client durable epoch so each harness gets a fresh
 * `harness_client_${id}_eN` secure-storage / auth namespace. Without this, a prior
 * openHarness that signed in leaves `sessionToken` under `e0` and the next guest
 * boot POSTs `/identity/refresh` against a dead JWT (fresh mockingbird-postgres).
 */
export async function createHarness(
  session: Session,
  opts: CreateHarnessOptions
): Promise<Harness> {
  const kernel = await bootHarnessKernel(session, opts);
  return createHarnessHandle(kernel);
}
