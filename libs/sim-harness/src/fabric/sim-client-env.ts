/**
 * One sim `ClientEnv`. The client's only HTTP port is the load balancer —
 * it never holds a direct handle to a server instance.
 */

import { setPendingSignupUsername } from '@libs/auth/public/pending-signup-username';
import type { ClientEnv } from '@libs/client-app/shell/client-env';
import { createInMemoryClientPorts } from '@libs/client-app/shell/in-memory-client-ports';
import { SIM_SERVER_URL } from '@libs/feature/public/sim-constants';
import { assert } from '@pkgs/assert';
import { createNamespacedAuthClientStorage } from '@pkgs/auth/client';
import type { Timers } from '@pkgs/clock';
import type { GoogleIdp } from '@pkgs/idp-google-sim/server';
import { KvImplInMemory } from '@pkgs/kv/impl-in-memory';
import { KvImplWebNamespaced } from '@pkgs/kv-web/impl-kv-web-namespaced';
import { createLogger } from '@pkgs/logger';
import {
  type createInMemoryBus,
  createInMemoryPubSub,
} from '@pkgs/pubsub/in-memory';
import { createInMemorySecureStorage } from '@pkgs/secure-storage/impl-memory';
import { createSecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';
import { createNamespacedWebSecureStorage } from '@pkgs/secure-storage-web';
import type { Session } from '@pkgs/sim';
import { createSeededCreateId, createSeededRng } from '@pkgs/uuid';
import type { SimComposition, SimRoomNode } from '../composition';
import { partitionAwareRoomTransport } from './partition-aware-room-transport';
import type { SimBillingProvider } from './sim-billing';
import { createSimBrowser, type SimBrowser } from './sim-browser';
import { simClientNamespace } from './sim-client-namespace';
import { simBrowserFetch } from './sim-idp';
import type { SimLoadBalancer } from './sim-load-balancer';
import type { SimNet } from './sim-net';
import { SIM_PRIMARY_SERVER_ID } from './sim-server-nodes';
import {
  handleBoundSqlClient,
  openFreshSimClientSql,
  type SimSql,
} from './sim-sql';

export type SimClientEnvDeps = {
  readonly session: Session;
  readonly seed: bigint;
  readonly timers: Timers;
  readonly net: SimNet;
  readonly pubSubBus: ReturnType<typeof createInMemoryBus>;
  readonly roomNode: SimRoomNode;
  readonly composition: SimComposition;
  readonly loadBalancer: SimLoadBalancer;
  readonly idp: GoogleIdp;
  readonly billing: SimBillingProvider | null;
};

function hasWebLocalStorage(): boolean {
  return typeof globalThis.localStorage !== 'undefined';
}

function clientKv(ns: string): ClientEnv['kv'] {
  return hasWebLocalStorage()
    ? new KvImplWebNamespaced(ns)
    : new KvImplInMemory();
}

function clientSecureStorage(ns: string): ClientEnv['secureStorage'] {
  return createSecureStorageStore(
    hasWebLocalStorage()
      ? createNamespacedWebSecureStorage(ns)
      : createInMemorySecureStorage()
  );
}

export function makeSimClientEnv(
  deps: SimClientEnvDeps,
  args: {
    readonly id: string;
    readonly clientSql: Map<string, SimSql>;
  }
): { readonly env: ClientEnv; readonly browser: SimBrowser } {
  const { session, seed, timers, net, pubSubBus, roomNode } = deps;
  const { id, clientSql } = args;
  const ns = simClientNamespace(id);
  const serverFetch = deps.loadBalancer.fetchFrom(id);
  const browserFetch = simBrowserFetch({
    idp: deps.idp,
    billing: deps.billing,
    net,
    from: id,
    server: serverFetch,
  });
  const browser = createSimBrowser({
    network: browserFetch,
    pages: deps.composition.browserPages ?? [],
    // DOM types claim `location` always exists; under Bun it does not.
    appOrigin: () =>
      'location' in globalThis ? globalThis.location.origin : null,
    // The actor id doubles as the sim username (client-a / client-b).
    onAuthSuccess: () => setPendingSignupUsername(id),
  });
  const pubsubLogger = createLogger({
    name: `sim-${id}:pubsub`,
    now: () => session.ports.clock.now(),
  });
  let liveEvents: ReturnType<typeof createInMemoryPubSub> | null =
    createInMemoryPubSub({ bus: pubSubBus, logger: pubsubLogger });
  const createPubSub = (): ReturnType<typeof createInMemoryPubSub> => {
    liveEvents?.close();
    liveEvents = createInMemoryPubSub({ bus: pubSubBus, logger: pubsubLogger });
    return liveEvents;
  };
  const env: ClientEnv = {
    clock: session.ports.clock,
    timers,
    createId: createSeededCreateId(
      createSeededRng(`${seed.toString()}:client:${ns}`).random
    ),
    random: session.ports.random,
    seed,
    server: serverFetch,
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
    kv: clientKv(ns),
    authStorage: createNamespacedAuthClientStorage(ns),
    secureStorage: clientSecureStorage(ns),
    room: (roomArgs) => {
      net.assertReachable(id, SIM_PRIMARY_SERVER_ID);
      return partitionAwareRoomTransport({
        open: () => roomNode.createTransport(roomArgs),
        reachable: () => net.isReachable(id, SIM_PRIMARY_SERVER_ID),
        timers,
      });
    },
    ...createInMemoryClientPorts(`sim-client:${id}`),
    serverUrl: SIM_SERVER_URL,
    authBaseURL: SIM_SERVER_URL,
    authCallbackUrl: `${SIM_SERVER_URL}/sso-callback`,
    openAuthSession: browser.openAuthSession,
    openExternalUrl: browser.openExternalUrl,
    resolveDatabaseName: () => ns,
    mutationSuccessHoldMs: 900,
  };
  return { env, browser };
}
