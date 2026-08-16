// @io-wall-ok — composition root: wall Io + in-process Hono + durable OPFS SQLite.
/**
 * Boot two isolated product actor sessions against an in-process
 * {@link createSimApiApp} Hono (no live Worker HTTP).
 *
 * Server + actor local DBs are durable expo-sqlite / OPFS with fixed names
 * (`playground_server` / `playground_alice` / `playground_bob`) so a page
 * refresh reopens the same files. Auth / KV / secure-storage are namespaced
 * into localStorage per actor.
 */

import { createSimApiApp } from '@apps/api/app/create-sim-api-app';
import type { OpenRequestDb } from '@apps/api/db/open-request-db';
import {
  migrateSimSqlite,
  SIM_API_URL,
  SIM_BETTER_AUTH_SECRET,
  SIM_SQLITE_DATABASE_URL,
} from '@apps/api/system/migrate-sim-sqlite';
import { createInMemoryDevMenuPort } from '@apps/client/device/in-memory-dev-menu-port';
import { createInMemoryNetworkStatePort } from '@apps/client/device/in-memory-network-state-port';
import { createInProcessRoomNode } from '@apps/client/host/in-process-room-node';
import type { ClientSystemResources } from '@apps/client/providers/client-system-resources';
import { createAppSyncEnginePool } from '@apps/client/sync/sync-engine-pool';
import type { CreateRoomTransport } from '@libs/spaces/client/room/room-transport-factory';
import { createInMemoryStripe } from '@libs/stripe/in-memory-stripe';
import {
  clearNamespacedAuthClientStorage,
  createNamespacedAuthClientStorage,
} from '@pkgs/auth-better-auth/client';
import type { Timers } from '@pkgs/clock';
import type { HttpClient } from '@pkgs/http-client';
import { createHonoHttpClient } from '@pkgs/http-client/hono-http-client';
import type { Io } from '@pkgs/io';
import { wallIo } from '@pkgs/io';
import { KvImplInMemory } from '@pkgs/kv/impl-in-memory';
import {
  clearNamespacedKvWeb,
  KvImplWebNamespaced,
} from '@pkgs/kv/impl-kv-web-namespaced';
import { InMemoryLlmProvider } from '@pkgs/llm/server';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import {
  createInMemoryBus,
  createInMemoryPubSub,
  type InMemoryBus,
} from '@pkgs/pubsub/testing/in-memory';
import { createInMemorySecureStorage } from '@pkgs/secure-storage/impl-memory';
import {
  clearNamespacedWebSecureStorage,
  createNamespacedWebSecureStorage,
} from '@pkgs/secure-storage/impl-web';
import { createSecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';
import { createInMemoryAudioPlaybackPort } from '@pkgs/sounds/audio-playback/in-memory-audio-playback-port';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplExpoSqlite } from '@pkgs/sql-client/sqlite/impl-expo-sqlite';
import {
  createExpoWebSqlClient,
  type ExpoWebSqlClient,
} from '@pkgs/sql-client/sqlite/web';
import {
  createPlaygroundLogBuffer,
  type PlaygroundLogBuffer,
  type PlaygroundSession,
} from '@pkgs/system-console/client';
import { InMemoryTtsProvider } from '@pkgs/tts/server';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

export const PLAYGROUND_DB_NAMES = {
  server: 'playground_server',
  alice: 'playground_alice',
  bob: 'playground_bob',
} as const;

export const PLAYGROUND_ACTOR_NAMESPACES = {
  alice: 'playground_alice',
  bob: 'playground_bob',
} as const;

type PlaygroundSqlHandle = {
  readonly sqlClient: SqlClient;
  readonly disconnect: () => Promise<void>;
  readonly reset: () => Promise<void>;
};

async function openPlaygroundSql(
  databaseName: string,
  timers: Timers
): Promise<PlaygroundSqlHandle> {
  if (Platform.OS === 'web') {
    const client: ExpoWebSqlClient = createExpoWebSqlClient(databaseName, {
      timers,
    });
    await client.connect();
    return {
      sqlClient: client,
      disconnect: () => client.disconnect(),
      reset: () => client.resetDatabase(),
    };
  }
  const client = await SqlClientImplExpoSqlite.open(databaseName, timers);
  await client.connect();
  return {
    sqlClient: client,
    disconnect: () => client.disconnect(),
    reset: async () => {
      await client.disconnect();
      await SQLite.deleteDatabaseAsync(databaseName);
    },
  };
}

/**
 * Request middleware always `disconnect()`s sqlite handles. Shared
 * process-lifetime playground DBs must ignore that — same idea as DST
 * `sharedRequestSqlClient`.
 */
function sharedRequestSqlClient(sqlClient: SqlClient): SqlClient {
  return {
    connect: async () => undefined,
    disconnect: async () => undefined,
    query: (query) => sqlClient.query(query),
    run: (query) => sqlClient.run(query),
    prepare: (query) => sqlClient.prepare(query),
    transaction: <T>(fn: (tx: SqlClient) => Promise<T>) =>
      sqlClient.transaction(fn),
  };
}

/**
 * Actor local DB is owned by the playground session. Sync-engine pool
 * `deactivatePrevious` / revoke call `db.disconnect()` on identity switches —
 * that must not close the session OPFS handle while ProductApp is still live.
 * Session `dispose()` / `wipe()` closes the real client.
 */
function sessionOwnedSqlClient(sqlClient: SqlClient): SqlClient {
  return {
    connect: async () => undefined,
    disconnect: async () => undefined,
    query: (query) => sqlClient.query(query),
    run: (query) => sqlClient.run(query),
    prepare: (query) => sqlClient.prepare(query),
    transaction: <T>(fn: (tx: SqlClient) => Promise<T>) =>
      sqlClient.transaction(fn),
  };
}

function makeActorIo(http: HttpClient): Io {
  const base = wallIo();
  return {
    ...base,
    http,
  };
}

/**
 * Stack-based web ALS cannot isolate overlapping `run()` calls. Serialize
 * in-process Hono traffic so alice/bob request scopes never interleave.
 */
function serializeHttpClient(inner: HttpClient): HttpClient {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    fetch(input, init) {
      const next = tail.then(() => inner.fetch(input, init));
      tail = next.then(
        () => undefined,
        () => undefined
      );
      return next;
    },
  };
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method != null) return init.method.toUpperCase();
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.method.toUpperCase();
  }
  return 'GET';
}

function requestPath(input: RequestInfo | URL): string {
  const href =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  try {
    return new URL(href).pathname;
  } catch {
    return href;
  }
}

/** Append `METHOD path → status` lines into a playground log buffer. */
function loggingHttpClient(
  inner: HttpClient,
  logs: PlaygroundLogBuffer,
  now: () => number
): HttpClient {
  return {
    async fetch(input, init) {
      const method = requestMethod(input, init);
      const path = requestPath(input);
      try {
        const res = await inner.fetch(input, init);
        logs.append({
          at: now(),
          level: res.ok ? 'info' : 'warn',
          msg: `${method} ${path} → ${res.status}`,
        });
        return res;
      } catch (err) {
        logs.append({
          at: now(),
          level: 'error',
          msg: `${method} ${path} → error`,
          context: {
            error: err instanceof Error ? err.message : String(err),
          },
        });
        throw err;
      }
    },
  };
}

function makeActorResources(args: {
  readonly apiUrl: string;
  readonly pubSubBus: InMemoryBus;
  readonly sqlClient: SqlClient;
  readonly databaseName: string;
  readonly namespace: string;
  readonly createRoomTransport: CreateRoomTransport;
}): {
  readonly resources: ClientSystemResources;
  readonly syncEnginePool: ReturnType<typeof createAppSyncEnginePool>;
} {
  const secureStorage =
    Platform.OS === 'web'
      ? createNamespacedWebSecureStorage(args.namespace)
      : createInMemorySecureStorage();
  const secureStorageStore = createSecureStorageStore(secureStorage);
  secureStorageStore.setValue('signInPending', null);
  const authClientStorage = createNamespacedAuthClientStorage(args.namespace);
  const kv =
    Platform.OS === 'web'
      ? new KvImplWebNamespaced(args.namespace)
      : new KvImplInMemory();
  const syncEnginePool = createAppSyncEnginePool();
  return {
    syncEnginePool,
    resources: {
      apiUrl: args.apiUrl,
      authBaseURL: args.apiUrl,
      authClientStorage,
      secureStorageStore,
      syncEnginePool,
      openSqlClient: async () => sessionOwnedSqlClient(args.sqlClient),
      resolveDatabaseName: () => args.databaseName,
      createPubSub: () => createInMemoryPubSub({ bus: args.pubSubBus }),
      kv,
      network: createInMemoryNetworkStatePort(),
      devMenu: createInMemoryDevMenuPort(),
      audio: createInMemoryAudioPlaybackPort(),
      createRoomTransport: args.createRoomTransport,
    },
  };
}

function clearActorDurablePorts(namespace: string): void {
  clearNamespacedAuthClientStorage(namespace);
  clearNamespacedKvWeb(namespace);
  clearNamespacedWebSecureStorage(namespace);
}

async function bootSimApi(args: {
  readonly io: Io;
  readonly serverSql: SqlClient;
  readonly pubSub: ReturnType<typeof createInMemoryPubSub>;
}) {
  const shared = sharedRequestSqlClient(args.serverSql);
  const openRequestDb: OpenRequestDb = async () => ({
    kind: 'sqlite',
    sqlClient: shared,
  });
  return createSimApiApp({
    io: {
      ...args.io,
      http: {
        fetch: () => {
          throw new Error('sim api Io.http is unused — in-process Hono only');
        },
      },
    },
    openRequestDb,
    sqlClient: args.serverSql,
    pubSub: args.pubSub,
    objectStore: new ObjectStoreImplInMemory(),
    stripe: createInMemoryStripe(),
    llmProvider: new InMemoryLlmProvider(),
    ttsProvider: new InMemoryTtsProvider(),
    betterAuthSecret: SIM_BETTER_AUTH_SECRET,
    databaseUrl: SIM_SQLITE_DATABASE_URL,
    apiUrl: SIM_API_URL,
  });
}

function wirePlaygroundHttp(
  app: { fetch: (request: Request) => Response | Promise<Response> },
  now: () => number
): {
  readonly aliceLogs: PlaygroundLogBuffer;
  readonly bobLogs: PlaygroundLogBuffer;
  readonly serverLogs: PlaygroundLogBuffer;
  readonly aliceHttp: HttpClient;
  readonly bobHttp: HttpClient;
} {
  const aliceLogs = createPlaygroundLogBuffer();
  const bobLogs = createPlaygroundLogBuffer();
  const serverLogs = createPlaygroundLogBuffer();
  const honoHttp = createHonoHttpClient({ app, origin: SIM_API_URL });
  const serialized = serializeHttpClient(
    loggingHttpClient(honoHttp, serverLogs, now)
  );
  return {
    aliceLogs,
    bobLogs,
    serverLogs,
    aliceHttp: loggingHttpClient(serialized, aliceLogs, now),
    bobHttp: loggingHttpClient(serialized, bobLogs, now),
  };
}

function buildPlaygroundSession(args: {
  readonly alice: ReturnType<typeof makeActorResources>;
  readonly bob: ReturnType<typeof makeActorResources>;
  readonly aliceHandle: PlaygroundSqlHandle;
  readonly bobHandle: PlaygroundSqlHandle;
  readonly serverHandle: PlaygroundSqlHandle;
  readonly aliceHttp: HttpClient;
  readonly bobHttp: HttpClient;
  readonly aliceLogs: PlaygroundLogBuffer;
  readonly bobLogs: PlaygroundLogBuffer;
  readonly serverLogs: PlaygroundLogBuffer;
  readonly roomNode: { dispose(): void };
}): PlaygroundSession<ClientSystemResources> {
  let disposed = false;
  const releaseEngines = async () => {
    await args.alice.syncEnginePool.releaseAll();
    await args.bob.syncEnginePool.releaseAll();
  };
  const closeSql = async () => {
    await args.aliceHandle.disconnect();
    await args.bobHandle.disconnect();
    await args.serverHandle.disconnect();
  };
  return {
    actors: {
      alice: {
        id: 'alice',
        io: makeActorIo(args.aliceHttp),
        resources: args.alice.resources,
        sqlClient: args.aliceHandle.sqlClient,
        logs: args.aliceLogs,
      },
      bob: {
        id: 'bob',
        io: makeActorIo(args.bobHttp),
        resources: args.bob.resources,
        sqlClient: args.bobHandle.sqlClient,
        logs: args.bobLogs,
      },
    },
    server: {
      id: 'server',
      sqlClient: args.serverHandle.sqlClient,
      logs: args.serverLogs,
    },
    async wipe() {
      if (disposed) return;
      await releaseEngines();
      await args.serverHandle.reset();
      await args.aliceHandle.reset();
      await args.bobHandle.reset();
      clearActorDurablePorts(PLAYGROUND_ACTOR_NAMESPACES.alice);
      clearActorDurablePorts(PLAYGROUND_ACTOR_NAMESPACES.bob);
      args.roomNode.dispose();
      await closeSql();
      disposed = true;
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      await releaseEngines();
      args.roomNode.dispose();
      await closeSql();
    },
  };
}

/**
 * Durable OPFS/expo-sqlite product actors + shared in-memory pubsub, talking
 * to an in-process `createSimApiApp` via {@link createHonoHttpClient}.
 */
export async function bootPlaygroundSession(): Promise<
  PlaygroundSession<ClientSystemResources>
> {
  const io = wallIo();
  const pubSubBus = createInMemoryBus();
  const pubSub = createInMemoryPubSub({ bus: pubSubBus });

  const serverHandle = await openPlaygroundSql(
    PLAYGROUND_DB_NAMES.server,
    io.timers
  );
  await migrateSimSqlite({ sqlClient: serverHandle.sqlClient, io });
  const app = await bootSimApi({
    io,
    serverSql: serverHandle.sqlClient,
    pubSub,
  });
  const roomNode = createInProcessRoomNode(io);
  const http = wirePlaygroundHttp(app, () => io.clock.now());

  const aliceHandle = await openPlaygroundSql(
    PLAYGROUND_DB_NAMES.alice,
    io.timers
  );
  const bobHandle = await openPlaygroundSql(PLAYGROUND_DB_NAMES.bob, io.timers);
  const alice = makeActorResources({
    apiUrl: SIM_API_URL,
    pubSubBus,
    sqlClient: aliceHandle.sqlClient,
    databaseName: PLAYGROUND_DB_NAMES.alice,
    namespace: PLAYGROUND_ACTOR_NAMESPACES.alice,
    createRoomTransport: roomNode.createTransport,
  });
  const bob = makeActorResources({
    apiUrl: SIM_API_URL,
    pubSubBus,
    sqlClient: bobHandle.sqlClient,
    databaseName: PLAYGROUND_DB_NAMES.bob,
    namespace: PLAYGROUND_ACTOR_NAMESPACES.bob,
    createRoomTransport: roomNode.createTransport,
  });

  return buildPlaygroundSession({
    alice,
    bob,
    aliceHandle,
    bobHandle,
    serverHandle,
    aliceHttp: http.aliceHttp,
    bobHttp: http.bobHttp,
    aliceLogs: http.aliceLogs,
    bobLogs: http.bobLogs,
    serverLogs: http.serverLogs,
    roomNode,
  });
}
