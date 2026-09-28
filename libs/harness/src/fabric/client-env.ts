/**
 * One harness `ClientEnv`. The client's only HTTP port is the load balancer —
 * it never holds a direct handle to a server instance.
 */

import { setPendingSignupUsername } from '@libs/auth/public/pending-signup-username';
import type { ClientEnv } from '@libs/client-app/shell/client-env';
import { createInMemoryClientPorts } from '@libs/client-app/shell/in-memory-client-ports';
import { HARNESS_SERVER_URL } from '@libs/feature/public/harness-constants';
import { assert } from '@pkgs/assert';
import {
  createInhouseAuthClient,
  createNamespacedAuthClientStorage,
} from '@pkgs/auth-inhouse/client';
import type { Timers } from '@pkgs/clock';
import type { Session } from '@pkgs/harness';
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
import { createSeededCreateId, createSeededRng } from '@pkgs/uuid';
import type { HarnessComposition, HarnessRoomNode } from '../composition';
import { appBuildFetch, type HarnessAppBuilds } from './app-build';
import type { HarnessBillingProviders } from './billing';
import { createHarnessBrowser, type HarnessBrowser } from './browser';
import { harnessClientNamespace } from './client-namespace';
import { type HarnessIdps, harnessBrowserFetch } from './idp';
import type { HarnessLoadBalancer } from './load-balancer';
import type { HarnessNet } from './net';
import { partitionAwareRoomTransport } from './partition-aware-room-transport';
import { HARNESS_PRIMARY_SERVER_ID } from './server-nodes';
import {
  type HarnessSql,
  handleBoundSqlClient,
  openFreshHarnessClientSql,
} from './sql';

export type HarnessClientEnvDeps = {
  readonly session: Session;
  readonly seed: bigint;
  readonly timers: Timers;
  readonly net: HarnessNet;
  readonly pubSubBus: ReturnType<typeof createInMemoryBus>;
  readonly roomNode: HarnessRoomNode;
  readonly composition: HarnessComposition;
  readonly loadBalancer: HarnessLoadBalancer;
  readonly idps: HarnessIdps;
  readonly billing: HarnessBillingProviders | null;
  readonly appBuilds: HarnessAppBuilds;
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

/** The client's only server HTTP: the balancer, as its app build sends it. */
function clientServerFetch(deps: HarnessClientEnvDeps, id: string) {
  return appBuildFetch(deps.appBuilds, id, deps.loadBalancer.fetchFrom(id));
}

export function makeHarnessClientEnv(
  deps: HarnessClientEnvDeps,
  args: {
    readonly id: string;
    readonly clientSql: Map<string, HarnessSql>;
  }
): { readonly env: ClientEnv; readonly browser: HarnessBrowser } {
  const { session, seed, timers, net, pubSubBus, roomNode } = deps;
  const { id, clientSql } = args;
  const ns = harnessClientNamespace(id);
  const serverFetch = clientServerFetch(deps, id);
  const browserFetch = harnessBrowserFetch({
    idps: deps.idps,
    billing: deps.billing,
    net,
    from: id,
    server: serverFetch,
  });
  const browser = createHarnessBrowser({
    network: browserFetch,
    pages: deps.composition.browserPages ?? [],
    // DOM types claim `location` always exists; under Bun it does not.
    appOrigin: () =>
      'location' in globalThis ? globalThis.location.origin : null,
    // The actor id doubles as the harness username (client-a / client-b).
    onAuthSuccess: () => setPendingSignupUsername(id),
  });
  const pubsubLogger = createLogger({
    name: `harness-${id}:pubsub`,
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
      assert.defined(liveEvents, 'harness client events');
      return liveEvents;
    },
    createPubSub,
    openSqlClient: async () => {
      let handle = clientSql.get(id);
      if (handle === undefined) {
        handle = await openFreshHarnessClientSql(
          `harness_client_${id}`,
          session.ports.clock
        );
        clientSql.set(id, handle);
      }
      return handleBoundSqlClient(handle);
    },
    kv: clientKv(ns),
    secureStorage: clientSecureStorage(ns),
    room: (roomArgs) => {
      net.assertReachable(id, HARNESS_PRIMARY_SERVER_ID);
      return partitionAwareRoomTransport({
        open: () => roomNode.createTransport(roomArgs),
        reachable: () => net.isReachable(id, HARNESS_PRIMARY_SERVER_ID),
        timers,
      });
    },
    ...createInMemoryClientPorts(),
    serverUrl: HARNESS_SERVER_URL,
    // The in-house IdP on the API origin, its window in the actor's browser.
    createAuthClient: () =>
      createInhouseAuthClient({
        baseURL: HARNESS_SERVER_URL,
        clock: session.ports.clock,
        timers,
        fetch: serverFetch,
        storage: createNamespacedAuthClientStorage(ns),
        openAuthSession: browser.openAuthSession,
        callbackUrl: `${HARNESS_SERVER_URL}/sso-callback`,
      }),
    openExternalUrl: browser.openExternalUrl,
    resolveDatabaseName: () => ns,
    mutationSuccessHoldMs: 900,
  };
  return { env, browser };
}
