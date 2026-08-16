/**
 * Playground World implements — live client handle (no RNTL Driver) + room stub.
 */

import { createSimApiApp } from '@apps/api/app/create-sim-api-app';
import {
  SIM_API_URL,
  SIM_BETTER_AUTH_SECRET,
  SIM_SQLITE_DATABASE_URL,
} from '@apps/api/system/migrate-sim-sqlite';
import { requireSimOpenRequestDb } from '@apps/api/system/sim-open-request-db';
import { createInMemoryDevMenuPort } from '@apps/client/device/in-memory-dev-menu-port';
import { createInMemoryNetworkStatePort } from '@apps/client/device/in-memory-network-state-port';
import type { InProcessRoomNode } from '@apps/client/host/in-process-room-node';
import {
  clientNamespace,
  sessionOwnedSqlClient,
} from '@apps/client/host/playground-provide';
import type { ClientSystemResources } from '@apps/client/providers/client-system-resources';
import { createAppSyncEnginePool } from '@apps/client/sync/sync-engine-pool';
import { ioFromResourceCtx } from '@apps/client/system/client-resource';
import { api, client, room } from '@libs/runtime/shared/system';
import {
  clearNamespacedAuthClientStorage,
  createNamespacedAuthClientStorage,
} from '@pkgs/auth-better-auth/client';
import type { Io } from '@pkgs/io';
import { asKeyword, asKeywordRecord } from '@pkgs/keyword/keyword';
import {
  clearNamespacedKvWeb,
  KvImplWebNamespaced,
} from '@pkgs/kv/impl-kv-web-namespaced';
import {
  createInMemoryPubSub,
  type InMemoryBus,
} from '@pkgs/pubsub/testing/in-memory';
import {
  clearNamespacedWebSecureStorage,
  createNamespacedWebSecureStorage,
} from '@pkgs/secure-storage/impl-web';
import { createSecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';
import { createInMemoryAudioPlaybackPort } from '@pkgs/sounds/audio-playback/in-memory-audio-playback-port';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { Fetch, ResourceCtx, ResourceImpl } from '@pkgs/system';
import { serveFetch } from '@pkgs/system';
import {
  createPlaygroundLogBuffer,
  type PlaygroundLogBuffer,
} from '@pkgs/system-console/client';

export type PlaygroundClientLive = {
  readonly id: string;
  readonly address: string;
  readonly io: Io;
  readonly resources: ClientSystemResources;
  readonly sqlClient: SqlClient;
  readonly logs: PlaygroundLogBuffer;
  readonly syncEnginePool: ReturnType<typeof createAppSyncEnginePool>;
  close(): Promise<void>;
};

function instanceIdFromClientAddress(address: string): string {
  const match = /^client:(.+)$/.exec(address);
  return match?.[1] ?? address;
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

export function loggingFetch(
  fetchFn: Fetch,
  logs: PlaygroundLogBuffer,
  serverLogs: PlaygroundLogBuffer,
  now: () => number
): Fetch {
  return async (input, init) => {
    const method = requestMethod(input, init);
    const path = requestPath(input);
    try {
      const res = await fetchFn(input, init);
      const entry = {
        at: now(),
        level: (res.ok ? 'info' : 'warn') as 'info' | 'warn',
        msg: `${method} ${path} → ${res.status}`,
      };
      logs.append(entry);
      serverLogs.append(entry);
      return res;
    } catch (err) {
      const entry = {
        at: now(),
        level: 'error' as const,
        msg: `${method} ${path} → error`,
        context: {
          error: err instanceof Error ? err.message : String(err),
        },
      };
      logs.append(entry);
      serverLogs.append(entry);
      throw err;
    }
  };
}

/**
 * Stack-based web ALS cannot isolate overlapping `run()` calls. Serialize
 * in-process Hono traffic so multi-client request scopes never interleave.
 */
export function serializeFetch(fetchFn: Fetch): Fetch {
  let tail: Promise<unknown> = Promise.resolve();
  return (input, init) => {
    const next = tail.then(() => fetchFn(input, init));
    tail = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  };
}

export function clearClientDurablePorts(instanceId: string): void {
  const ns = clientNamespace(instanceId);
  clearNamespacedKvWeb(ns);
  clearNamespacedAuthClientStorage(ns);
  clearNamespacedWebSecureStorage(ns);
}

function ioFromCtx(ctx: ResourceCtx): Io {
  return {
    clock: ctx.clock,
    timers: ctx.timers,
    createId: ctx.createId,
    random: ctx.random,
    http: {
      fetch: () => {
        throw new Error('sim api Io.http is unused — in-process Hono only');
      },
    },
    seed: ctx.seed,
  };
}

const playgroundApiResource = api.implement(async (deps, ctx) => {
  const app = await createSimApiApp({
    io: ioFromCtx(ctx),
    openRequestDb: requireSimOpenRequestDb(deps.db),
    sqlClient: deps.db,
    pubSub: deps.events,
    objectStore: deps.media,
    stripe: deps.payments,
    llmProvider: deps.llm,
    ttsProvider: deps.tts,
    betterAuthSecret: SIM_BETTER_AUTH_SECRET,
    databaseUrl: SIM_SQLITE_DATABASE_URL,
    apiUrl: SIM_API_URL,
  });
  return serveFetch((request) => app.fetch(request));
});

const VALUE_KEY = asKeyword('room/value');
const TEXT_ATTR = asKeyword('room/text');

/** DST-style room Fetch stub — real loopback is injected via client seams. */
const playgroundRoomResource = room.implement((deps) => {
  return serveFetch(async (req) => {
    const url = new URL(req.url);
    const isSet =
      req.method === 'POST' ||
      url.pathname.endsWith('/set') ||
      url.searchParams.get('op') === 'set';
    if (isSet) {
      const text = await req.text();
      await deps.storage.put(
        VALUE_KEY,
        asKeywordRecord({ 'room/text': text }, 'room value')
      );
      return new Response('ok');
    }
    const row = await deps.storage.get(VALUE_KEY);
    const text =
      row && typeof row[TEXT_ATTR] === 'string' ? String(row[TEXT_ATTR]) : '';
    return new Response(text);
  });
});

export function createPlaygroundClientResource(args: {
  readonly pubSubBus: InMemoryBus;
  readonly roomNode: InProcessRoomNode;
  readonly serverLogs: PlaygroundLogBuffer;
  readonly getApiFetch: () => Fetch;
}): ResourceImpl<unknown, PlaygroundClientLive> {
  return client.implement<PlaygroundClientLive>(async (deps, ctx) => {
    const id = instanceIdFromClientAddress(ctx.address);
    const logs = createPlaygroundLogBuffer();
    const apiFetch = loggingFetch(
      args.getApiFetch(),
      logs,
      args.serverLogs,
      () => ctx.clock.now()
    );
    void deps.api;
    const io = ioFromResourceCtx(ctx, apiFetch);
    const ns = clientNamespace(id);
    // Namespaced localStorage — same surface snapshot save/load dumps via
    // dumpNamespacedKvWeb / restoreNamespacedKvWeb (auth + secure + kv share
    // the `ns.` prefix).
    const secureStorage = createNamespacedWebSecureStorage(ns);
    const secureStorageStore = createSecureStorageStore(secureStorage);
    secureStorageStore.setValue('signInPending', null);
    const authClientStorage = createNamespacedAuthClientStorage(ns);
    const kv = new KvImplWebNamespaced(ns);
    // Prefetch session keys so AuthBridge / profile chrome see restored state
    // before first paint (hydrate is otherwise lazy via React).
    await Promise.all([
      secureStorageStore.hydrate('sessionToken'),
      secureStorageStore.hydrate('deviceId'),
      secureStorageStore.hydrate('sessionExpiresAt'),
      secureStorageStore.hydrate('sessionExternalUserId'),
      secureStorageStore.hydrate('lastLocalAccountId'),
    ]);
    const syncEnginePool = createAppSyncEnginePool();
    // deps.db is handle-bound (playground provide); wrap only to no-op disconnect.
    const sqlClient = sessionOwnedSqlClient(deps.db);
    // Epoch-scoped logical name so SyncEngineBoot drops sticky engines and Web
    // Locks (if any) never collide across snapshot reloads.
    const resolveDatabaseName = () => clientNamespace(id);
    const resources: ClientSystemResources = {
      apiUrl: SIM_API_URL,
      authBaseURL: SIM_API_URL,
      authClientStorage,
      secureStorageStore,
      syncEnginePool,
      openSqlClient: async () => sqlClient,
      resolveDatabaseName,
      createPubSub: () => createInMemoryPubSub({ bus: args.pubSubBus }),
      kv,
      network: createInMemoryNetworkStatePort(),
      devMenu: createInMemoryDevMenuPort(),
      audio: createInMemoryAudioPlaybackPort(),
      db: sqlClient,
      createRoomTransport: args.roomNode.createTransport,
    };
    return {
      id,
      address: ctx.address,
      io,
      resources,
      sqlClient: deps.db,
      logs,
      syncEnginePool,
      async close() {
        await syncEnginePool.releaseAll();
      },
    };
  });
}

export function createPlaygroundImpls(args: {
  readonly pubSubBus: InMemoryBus;
  readonly roomNode: InProcessRoomNode;
  readonly serverLogs: PlaygroundLogBuffer;
  readonly getApiFetch: () => Fetch;
}): ResourceImpl<unknown, unknown>[] {
  return [
    playgroundApiResource,
    playgroundRoomResource,
    createPlaygroundClientResource(args),
  ];
}
