// @io-wall-ok — composition root: wall Io + in-process Hono + AlaSQL actors.
/**
 * Boot two isolated product actor sessions against an in-process
 * {@link createSimApiApp} Hono (no live Worker HTTP).
 *
 * World/DST fault injection stays in `@test/ui`. Client AlaSQL named DBs avoid
 * Expo OPFS multi-actor open failures on web.
 */

import { createSimApiApp } from '@apps/api/app/create-sim-api-app';
import {
  migrateSimSqlite,
  SIM_API_URL,
  SIM_BETTER_AUTH_SECRET,
  SIM_SQLITE_DATABASE_URL,
} from '@apps/api/system/migrate-sim-sqlite';
import { createInMemoryDevMenuPort } from '@apps/client/device/in-memory-dev-menu-port';
import { createInMemoryNetworkStatePort } from '@apps/client/device/in-memory-network-state-port';
import type { ClientSystemResources } from '@apps/client/providers/client-system-resources';
import { createAppSyncEnginePool } from '@apps/client/sync/sync-engine-pool';
import { createInMemoryStripe } from '@libs/stripe/in-memory-stripe';
import { createInMemoryAuthClientStorage } from '@pkgs/auth-better-auth/client';
import type { HttpClient } from '@pkgs/http-client';
import { createHonoHttpClient } from '@pkgs/http-client/hono-http-client';
import type { Io } from '@pkgs/io';
import { wallIo } from '@pkgs/io';
import { KvImplInMemory } from '@pkgs/kv/impl-in-memory';
import { InMemoryLlmProvider } from '@pkgs/llm/server';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import {
  createInMemoryBus,
  createInMemoryPubSub,
  type InMemoryBus,
} from '@pkgs/pubsub/testing/in-memory';
import { createInMemorySecureStorage } from '@pkgs/secure-storage/impl-memory';
import { createSecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';
import { createInMemoryAudioPlaybackPort } from '@pkgs/sounds/audio-playback/in-memory-audio-playback-port';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplAlaSql } from '@pkgs/sql-client/sqlite/impl-alasql';
import {
  createPlaygroundLogBuffer,
  type PlaygroundLogBuffer,
  type PlaygroundSession,
} from '@pkgs/system-console/client';
import { InMemoryTtsProvider } from '@pkgs/tts/server';

async function openNamedSql(name: string): Promise<SqlClient> {
  const client = SqlClientImplAlaSql.open(name);
  await client.connect();
  return client;
}

/**
 * Request middleware always `disconnect()`s the per-request client. Shared
 * process-lifetime AlaSQL must ignore that — same pattern as DST
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
 * that must not DROP the session AlaSQL handle while ProductApp is still live
 * (or mid-unmount). Session `dispose()` closes the real client.
 */
function sessionOwnedSqlClient(sqlClient: SqlClient): SqlClient {
  return sharedRequestSqlClient(sqlClient);
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
}): {
  readonly resources: ClientSystemResources;
  readonly syncEnginePool: ReturnType<typeof createAppSyncEnginePool>;
} {
  const secureStorageStore = createSecureStorageStore(
    createInMemorySecureStorage()
  );
  secureStorageStore.setValue('signInPending', null);
  const authClientStorage = createInMemoryAuthClientStorage();
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
      kv: new KvImplInMemory(),
      network: createInMemoryNetworkStatePort(),
      devMenu: createInMemoryDevMenuPort(),
      audio: createInMemoryAudioPlaybackPort(),
    },
  };
}

async function bootSimApi(args: {
  readonly io: Io;
  readonly serverSql: SqlClient;
  readonly pubSub: ReturnType<typeof createInMemoryPubSub>;
}) {
  return createSimApiApp({
    io: {
      ...args.io,
      http: {
        fetch: () => {
          throw new Error('sim api Io.http is unused — in-process Hono only');
        },
      },
    },
    openRequestDb: async () => ({
      kind: 'sqlite',
      sqlClient: sharedRequestSqlClient(args.serverSql),
    }),
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

/**
 * Two AlaSQL-backed product actors + shared in-memory pubsub, talking to an
 * in-process `createSimApiApp` (AlaSQL server DB) via {@link createHonoHttpClient}.
 */
export async function bootPlaygroundSession(): Promise<
  PlaygroundSession<ClientSystemResources>
> {
  const io = wallIo();
  const pubSubBus = createInMemoryBus();
  const pubSub = createInMemoryPubSub({ bus: pubSubBus });

  // Unique AlaSQL names per boot — React Strict Mode / remount disposes an
  // overlapping session; fixed names (`sim_api`) DROP the live session's DB.
  const sessionKey = io
    .createId()
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 16);
  const serverSql = await openNamedSql(`sim_api_${sessionKey}`);
  await migrateSimSqlite({ sqlClient: serverSql, io });

  const app = await bootSimApi({ io, serverSql, pubSub });

  const aliceLogs = createPlaygroundLogBuffer();
  const bobLogs = createPlaygroundLogBuffer();
  const serverLogs = createPlaygroundLogBuffer();
  const now = () => io.clock.now();

  const honoHttp = createHonoHttpClient({ app, origin: SIM_API_URL });
  const serverLoggedHttp = loggingHttpClient(honoHttp, serverLogs, now);
  const serialized = serializeHttpClient(serverLoggedHttp);
  const aliceHttp = loggingHttpClient(serialized, aliceLogs, now);
  const bobHttp = loggingHttpClient(serialized, bobLogs, now);

  const aliceSql = await openNamedSql(`sim_alice_${sessionKey}`);
  const bobSql = await openNamedSql(`sim_bob_${sessionKey}`);
  const alice = makeActorResources({
    apiUrl: SIM_API_URL,
    pubSubBus,
    sqlClient: aliceSql,
    databaseName: `sim_alice_${sessionKey}`,
  });
  const bob = makeActorResources({
    apiUrl: SIM_API_URL,
    pubSubBus,
    sqlClient: bobSql,
    databaseName: `sim_bob_${sessionKey}`,
  });

  return {
    actors: {
      alice: {
        id: 'alice',
        io: makeActorIo(aliceHttp),
        resources: alice.resources,
        sqlClient: aliceSql,
        logs: aliceLogs,
      },
      bob: {
        id: 'bob',
        io: makeActorIo(bobHttp),
        resources: bob.resources,
        sqlClient: bobSql,
        logs: bobLogs,
      },
    },
    server: {
      id: 'server',
      sqlClient: serverSql,
      logs: serverLogs,
    },
    async dispose() {
      // MutationUploadQueue keeps draining after ProductApp unmount — stop
      // engines before DROP DATABASE or requireDb asserts closed.
      await alice.syncEnginePool.releaseAll();
      await bob.syncEnginePool.releaseAll();
      await aliceSql.disconnect();
      await bobSql.disconnect();
      await serverSql.disconnect();
    },
  };
}
