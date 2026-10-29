/**
 * One harness `ClientEnv`. The client's only HTTP port is the load balancer —
 * it never holds a direct handle to a server instance.
 */

import type { ClientEnv } from '@libs/app-root-client-ts/client-env';
import { createInMemoryClientPorts } from '@libs/app-root-client-ts/in-memory-client-ports';
import { setOriginAvailability } from '@libs/app-root-client-ts/origin-availability-for-env';
import { createAppBearerTokenStore } from '@libs/app-root-shared-ts/auth-client-storage';
import { setPendingSignupUsername } from '@libs/auth-shared-ts/pending-signup-username';
import { HARNESS_SERVER_URL } from '@libs/sub-shared-ts/harness-constants';
import { createNamespacedAuthClientStorage } from '@pkgs/auth-inhouse-client-ts/bearer-token-storage-web';
import { createInhouseAuthClient } from '@pkgs/auth-inhouse-client-ts/create-inhouse-auth-client';
import type { Timers } from '@pkgs/clock-shared-ts/types';
import type { Session } from '@pkgs/harness-root-shared-ts/runtime-types';
import { KvImplInMemory } from '@pkgs/kv-root-shared-ts/impl-in-memory';
import { KvImplWebNamespaced } from '@pkgs/kv-web-client-ts/impl-kv-web-namespaced';
import { createLogger } from '@pkgs/logger-shared-ts/logger';
import type { createInMemoryBus } from '@pkgs/pubsub-root-shared-ts/in-memory';
import { createInMemoryPubSub } from '@pkgs/pubsub-root-shared-ts/in-memory';
import { createInMemorySecureStorage } from '@pkgs/secure-storage-root-shared-ts/impl-memory';
import { createSecureStorageStore } from '@pkgs/secure-storage-root-shared-ts/secure-storage-store';
import { createNamespacedWebSecureStorage } from '@pkgs/secure-storage-web-client-ts/impl-web';
import { createSeededCreateId } from '@pkgs/uuid-shared-ts/seeded-create-id';
import { createSeededRng } from '@pkgs/uuid-shared-ts/seeded-rng';
import type { HarnessAccountReadyDelays } from './account-ready-delay';
import { accountReadyDelayFetch } from './account-ready-delay';
import type { HarnessAppBuilds } from './app-build';
import { appBuildFetch } from './app-build';
import type { HarnessBillingProviders } from './billing';
import type { HarnessBrowser } from './browser';
import { createHarnessBrowser } from './browser';
import { harnessClientServerFetch } from './client-server-fetch';
import { harnessClientSql } from './client-sql';
import type { HarnessComposition, HarnessRoomNode } from './composition';
import type { HarnessIdps } from './idp';
import { harnessBrowserFetch } from './idp';
import type { HarnessLoadBalancer } from './load-balancer';
import type { HarnessNet } from './net';
import { partitionAwarePubSub } from './partition-aware-pubsub';
import { partitionAwareRoomTransport } from './partition-aware-room-transport';
import { HARNESS_PRIMARY_SERVER_ID } from './server-nodes';
import type { HarnessSql } from './sql-types';
import type { HarnessSyntheticUserDevices } from './synthetic-user-devices';
import type { HarnessTeamRules } from './team-rules';

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
  readonly teamRules: HarnessTeamRules;
  readonly appBuilds: HarnessAppBuilds;
  readonly accountReadyDelays: HarnessAccountReadyDelays;
  readonly syntheticUserDevices: HarnessSyntheticUserDevices;
  /** Devices whose local database fails every call from their next opening. */
  readonly unusableDeviceData: ReadonlySet<string>;
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

/**
 * The client's only server HTTP: the balancer, as its app build sends it,
 * answered as slowly as the device's account-ready delay says.
 */
function clientServerFetch(deps: HarnessClientEnvDeps, id: string) {
  return accountReadyDelayFetch({
    delays: deps.accountReadyDelays,
    clientId: id,
    timers: deps.timers,
    inner: appBuildFetch(deps.appBuilds, id, deps.loadBalancer.fetchFrom(id)),
  });
}

function clientEvents(deps: HarnessClientEnvDeps, id: string) {
  const pubsubLogger = createLogger({
    name: `harness-${id}:pubsub`,
    now: () => deps.session.ports.clock.now(),
  });
  const openEvents = (): ReturnType<typeof createInMemoryPubSub> =>
    partitionAwarePubSub({
      inner: createInMemoryPubSub({
        bus: deps.pubSubBus,
        logger: pubsubLogger,
      }),
      reachable: () =>
        deps.net.isReachable(id, HARNESS_PRIMARY_SERVER_ID) &&
        deps.net.isReachable(`${id}:events`, HARNESS_PRIMARY_SERVER_ID),
      subscribeReachability: deps.net.subscribe,
      timers: deps.timers,
    });
  let liveEvents: ReturnType<typeof createInMemoryPubSub> = openEvents();
  const recreate = (): ReturnType<typeof createInMemoryPubSub> => {
    liveEvents.close();
    liveEvents = openEvents();
    return liveEvents;
  };
  return { current: () => liveEvents, recreate };
}

function clientSqlOpener(
  deps: HarnessClientEnvDeps,
  id: string,
  handles: Map<string, HarnessSql>,
  storage: ClientEnv['secureStorage']
): ClientEnv['openSqlClient'] {
  return harnessClientSql({
    id,
    handles,
    clock: deps.session.ports.clock,
    storage,
    unusable: () => deps.unusableDeviceData.has(id),
  });
}

export function makeHarnessClientEnv(
  deps: HarnessClientEnvDeps,
  args: {
    readonly id: string;
    readonly clientSql: Map<string, HarnessSql>;
    readonly namespace: string;
  }
): { readonly env: ClientEnv; readonly browser: HarnessBrowser } {
  const { session, seed, timers, net, roomNode } = deps;
  const { id, clientSql } = args;
  const ns = args.namespace;
  const server = harnessClientServerFetch({
    serverUrl: HARNESS_SERVER_URL,
    fetch: clientServerFetch(deps, id),
    clock: session.ports.clock,
    timers,
  });
  const serverFetch = server.fetch;
  const browserFetch = harnessBrowserFetch({
    idps: deps.idps,
    billing: deps.billing,
    net,
    from: id,
    server: serverFetch,
  });
  const browser = createHarnessBrowser({
    network: browserFetch,
    // DOM types claim `location` always exists; under Bun it does not.
    appOrigin: () =>
      'location' in globalThis ? globalThis.location.origin : null,
    // The actor id doubles as the harness username (client-a / client-b).
    onAuthSuccess: () =>
      setPendingSignupUsername(env.createAuthClient(env.server), id),
  });
  const events = clientEvents(deps, id);
  let authClient: ReturnType<typeof createInhouseAuthClient> | undefined;
  const secureStorage = clientSecureStorage(ns);
  const env: ClientEnv = {
    clock: session.ports.clock,
    timers,
    createId: createSeededCreateId(
      createSeededRng(`${seed.toString()}:client:${ns}`).random
    ),
    random: roomNode.clientRandom ?? session.ports.random,
    seed,
    server: serverFetch,
    get events() {
      return events.current();
    },
    createPubSub: events.recreate,
    openSqlClient: clientSqlOpener(deps, id, clientSql, secureStorage),
    kv: clientKv(ns),
    secureStorage,
    room: (roomArgs) => {
      return partitionAwareRoomTransport({
        open: () => roomNode.createTransport(roomArgs),
        reachable: () => net.isReachable(id, HARNESS_PRIMARY_SERVER_ID),
        subscribeReachability: net.subscribe,
        timers,
      });
    },
    ...createInMemoryClientPorts(),
    serverUrl: HARNESS_SERVER_URL,
    // The in-house IdP on the API origin, its window in the actor's browser.
    createAuthClient: (http) =>
      (authClient ??= createInhouseAuthClient({
        baseURL: HARNESS_SERVER_URL,
        clock: session.ports.clock,
        timers,
        fetch: http,
        bearerStore: createAppBearerTokenStore(
          createNamespacedAuthClientStorage(ns)
        ),
        openAuthSession: browser.openAuthSession,
        callbackUrl: `${HARNESS_SERVER_URL}/sso-callback`,
      })),
    // Read when the app starts: only a Synthetic User's host offers email.
    get emailSignIn() {
      return deps.syntheticUserDevices.has(id);
    },
    openExternalUrl: browser.openExternalUrl,
    resolveDatabaseName: ({ userId }) => `${ns}_${userId}`,
    mutationSuccessHoldMs: 900,
    moderation: deps.teamRules.forDevice({
      reachable: () => net.isReachable(id, HARNESS_PRIMARY_SERVER_ID),
      subscribeReachability: net.subscribe,
    }),
  };
  setOriginAvailability(env, server.availability);
  return { env, browser };
}
