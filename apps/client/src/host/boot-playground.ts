// @io-wall-ok — composition root: wall Io + in-process Hono + pg-mem server + AlaSQL actors.
/**
 * Boot two isolated product actor sessions against an in-process
 * {@link createSimApiApp} Hono (no live Worker HTTP).
 *
 * Server DB is pg-mem (Postgres path + Better Auth pool). Actor local DBs stay
 * AlaSQL — {@link SqliteSchemaDatabaseMigration} requires SQLite DDL; named
 * in-memory DBs avoid Expo OPFS multi-actor open failures on web.
 */

import { createSimApiApp } from '@apps/api/app/create-sim-api-app';
import {
  migrateSimPostgres,
  SIM_API_URL,
  SIM_BETTER_AUTH_SECRET,
  SIM_PG_MEM_DATABASE_URL,
} from '@apps/api/system/migrate-sim-postgres';
import { createInMemoryDevMenuPort } from '@apps/client/device/in-memory-dev-menu-port';
import { createInMemoryNetworkStatePort } from '@apps/client/device/in-memory-network-state-port';
import { createInProcessRoomNode } from '@apps/client/host/in-process-room-node';
import type { ClientSystemResources } from '@apps/client/providers/client-system-resources';
import { createAppSyncEnginePool } from '@apps/client/sync/sync-engine-pool';
import { appPostgresDbScope } from '@libs/infra/namespace-bindings';
import type { CreateRoomTransport } from '@libs/spaces/client/room/room-transport-factory';
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
import type { PostgresSqlClient, SqlClient } from '@pkgs/sql-client/interface';
import {
  createPgMemSqlClient,
  type PgMemSqlClientBundle,
} from '@pkgs/sql-client/postgres/impl-pg-mem';
import type { Pool } from '@pkgs/sql-client/postgres/pg-types';
import { SqlClientImplAlaSql } from '@pkgs/sql-client/sqlite/impl-alasql';
import {
  createPlaygroundLogBuffer,
  type PlaygroundLogBuffer,
  type PlaygroundSession,
} from '@pkgs/system-console/client';
import { InMemoryTtsProvider } from '@pkgs/tts/server';

async function openNamedAlaSql(name: string): Promise<SqlClient> {
  const client = SqlClientImplAlaSql.open(name);
  await client.connect();
  return client;
}

/**
 * Request middleware always `disconnect()`s / `pool.end()`s postgres handles.
 * Shared process-lifetime pg-mem must ignore that — same idea as DST
 * `sharedRequestSqlClient` for SQLite.
 */
function sharedRequestPostgres(bundle: {
  readonly sqlClient: PostgresSqlClient;
  readonly pool: Pool;
}): {
  readonly kind: 'postgres';
  readonly sqlClient: PostgresSqlClient;
  readonly pool: Pool;
} {
  const sqlClient: PostgresSqlClient = {
    dbScope: bundle.sqlClient.dbScope,
    connect: async () => undefined,
    disconnect: async () => undefined,
    query: (query) => bundle.sqlClient.query(query),
    run: (query) => bundle.sqlClient.run(query),
    prepare: (query) => bundle.sqlClient.prepare(query),
    transaction: <T>(fn: (tx: SqlClient) => Promise<T>) =>
      bundle.sqlClient.transaction(fn),
  };
  const pool = new Proxy(bundle.pool, {
    get(target, prop, receiver) {
      if (prop === 'end') {
        return async () => undefined;
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function'
        ? (value as (...args: unknown[]) => unknown).bind(target)
        : value;
    },
  }) as Pool;
  return { kind: 'postgres', sqlClient, pool };
}

/**
 * Actor local DB is owned by the playground session. Sync-engine pool
 * `deactivatePrevious` / revoke call `db.disconnect()` on identity switches —
 * that must not DROP the session AlaSQL handle while ProductApp is still live
 * (or mid-unmount). Session `dispose()` closes the real client.
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
  readonly createRoomTransport: CreateRoomTransport;
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
      createRoomTransport: args.createRoomTransport,
    },
  };
}

async function bootSimApi(args: {
  readonly io: Io;
  readonly server: PgMemSqlClientBundle;
  readonly pubSub: ReturnType<typeof createInMemoryPubSub>;
}) {
  const shared = sharedRequestPostgres({
    sqlClient: args.server.sqlClient,
    pool: args.server.pool,
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
    openRequestDb: async () => shared,
    sqlClient: args.server.sqlClient,
    pubSub: args.pubSub,
    objectStore: new ObjectStoreImplInMemory(),
    stripe: createInMemoryStripe(),
    llmProvider: new InMemoryLlmProvider(),
    ttsProvider: new InMemoryTtsProvider(),
    betterAuthSecret: SIM_BETTER_AUTH_SECRET,
    databaseUrl: SIM_PG_MEM_DATABASE_URL,
    apiUrl: SIM_API_URL,
  });
}

/**
 * AlaSQL-backed product actors + shared in-memory pubsub, talking to an
 * in-process `createSimApiApp` (pg-mem server DB) via {@link createHonoHttpClient}.
 */
export async function bootPlaygroundSession(): Promise<
  PlaygroundSession<ClientSystemResources>
> {
  const io = wallIo();
  const pubSubBus = createInMemoryBus();
  const pubSub = createInMemoryPubSub({ bus: pubSubBus });

  // Unique actor AlaSQL names per boot — React Strict Mode / remount disposes an
  // overlapping session; fixed names DROP the live session's DB.
  const sessionKey = io
    .createId()
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 16);

  const server = createPgMemSqlClient({ dbScope: appPostgresDbScope() });
  await server.sqlClient.connect();
  await migrateSimPostgres({
    sqlClient: server.sqlClient,
    pool: server.pool,
    io,
  });

  const app = await bootSimApi({ io, server, pubSub });

  const roomNode = createInProcessRoomNode(io);

  const aliceLogs = createPlaygroundLogBuffer();
  const bobLogs = createPlaygroundLogBuffer();
  const serverLogs = createPlaygroundLogBuffer();
  const now = () => io.clock.now();

  const honoHttp = createHonoHttpClient({ app, origin: SIM_API_URL });
  const serverLoggedHttp = loggingHttpClient(honoHttp, serverLogs, now);
  const serialized = serializeHttpClient(serverLoggedHttp);
  const aliceHttp = loggingHttpClient(serialized, aliceLogs, now);
  const bobHttp = loggingHttpClient(serialized, bobLogs, now);

  const aliceSql = await openNamedAlaSql(`sim_alice_${sessionKey}`);
  const bobSql = await openNamedAlaSql(`sim_bob_${sessionKey}`);
  const alice = makeActorResources({
    apiUrl: SIM_API_URL,
    pubSubBus,
    sqlClient: aliceSql,
    databaseName: `sim_alice_${sessionKey}`,
    createRoomTransport: roomNode.createTransport,
  });
  const bob = makeActorResources({
    apiUrl: SIM_API_URL,
    pubSubBus,
    sqlClient: bobSql,
    databaseName: `sim_bob_${sessionKey}`,
    createRoomTransport: roomNode.createTransport,
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
      sqlClient: server.sqlClient,
      logs: serverLogs,
    },
    async dispose() {
      // MutationUploadQueue keeps draining after ProductApp unmount — stop
      // engines before DROP DATABASE or requireDb asserts closed.
      await alice.syncEnginePool.releaseAll();
      await bob.syncEnginePool.releaseAll();
      roomNode.dispose();
      await aliceSql.disconnect();
      await bobSql.disconnect();
      await server.sqlClient.disconnect();
    },
  };
}
