/**
 * One sim `ClientEnv`. The client's only HTTP port is the load balancer —
 * it never holds a direct handle to a server instance.
 */

import type { ClientEnv } from '@apps/client/shell/client-env';
import { createInMemoryClientPorts } from '@apps/client/shell/in-memory-client-ports';
import type { RoomServerApp } from '@apps/room-server/app/create-room-server';
import { SIM_SERVER_URL } from '@apps/server/sim/migrate-sim-postgres';
import { setPendingSignupUsername } from '@libs/auth/public/pending-signup-username';
import { assert } from '@pkgs/assert';
import {
  createInProcessOpenAuthSession,
  createNamespacedAuthClientStorage,
} from '@pkgs/auth/client';
import type { Timers } from '@pkgs/clock';
import type { GoogleIdp } from '@pkgs/idp-google-sim/server';
import { IDP_PASSWORD } from '@pkgs/idp-google-sim/shared';
import { KvImplInMemory } from '@pkgs/kv/impl-in-memory';
import { KvImplWebNamespaced } from '@pkgs/kv-web/impl-kv-web-namespaced';
import {
  type createInMemoryBus,
  createInMemoryPubSub,
} from '@pkgs/pubsub/in-memory';
import { createInMemorySecureStorage } from '@pkgs/secure-storage/impl-memory';
import { createSecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';
import { createNamespacedWebSecureStorage } from '@pkgs/secure-storage-web';
import type { Session } from '@pkgs/sim';
import { createSeededCreateId, createSeededRng } from '@pkgs/uuid';
import { simClientNamespace } from './sim-client-namespace';
import { simBrowserFetch, simIdpEmail } from './sim-idp';
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
  readonly roomNode: RoomServerApp;
  readonly loadBalancer: SimLoadBalancer;
  readonly idp: GoogleIdp;
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
 * The sign-in popup, headless. It walks the provider's real screens — the
 * account chooser, the password form, the consent card — the same way the
 * bun-webview host walks them with a live browser.
 */
function clientOpenAuthSession(
  id: string,
  browserFetch: ClientEnv['server']
): ClientEnv['openAuthSession'] {
  const completeAuth = createInProcessOpenAuthSession({
    fetch: (input, init) => browserFetch(input, init),
    account: { email: simIdpEmail(id), password: IDP_PASSWORD },
  });
  return async (authorizationUrl, callbackUrl) => {
    const result = await completeAuth(authorizationUrl, callbackUrl);
    if (result.type === 'success') {
      // The actor id doubles as the sim username (client-a / client-b).
      setPendingSignupUsername(id);
    }
    return result;
  };
}

export function makeSimClientEnv(
  deps: SimClientEnvDeps,
  args: {
    readonly id: string;
    readonly clientSql: Map<string, SimSql>;
  }
): ClientEnv {
  const { session, seed, timers, net, pubSubBus, roomNode } = deps;
  const { id, clientSql } = args;
  const ns = simClientNamespace(id);
  const serverFetch = deps.loadBalancer.fetchFrom(id);
  const browserFetch = simBrowserFetch({
    idp: deps.idp,
    net,
    from: id,
    server: serverFetch,
  });
  let liveEvents: ReturnType<typeof createInMemoryPubSub> | null =
    createInMemoryPubSub({ bus: pubSubBus });
  const createPubSub = (): ReturnType<typeof createInMemoryPubSub> => {
    liveEvents?.close();
    liveEvents = createInMemoryPubSub({ bus: pubSubBus });
    return liveEvents;
  };
  return {
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
      return roomNode.createTransport(roomArgs);
    },
    ...createInMemoryClientPorts(`sim-client:${id}`),
    serverUrl: SIM_SERVER_URL,
    authBaseURL: SIM_SERVER_URL,
    authCallbackUrl: `${SIM_SERVER_URL}/sso-callback`,
    openAuthSession: clientOpenAuthSession(id, browserFetch),
    resolveDatabaseName: () => ns,
    mutationSuccessHoldMs: 900,
  };
}
