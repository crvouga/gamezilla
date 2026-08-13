/**
 * Product {@link SimulationSystem} for `@apps/client`: boots in-process
 * SQLite, migrates it, mounts the real API via Hono, and hands each actor an
 * isolated client stack rendered through Expo Router's testing library + RNTL.
 */

import path from 'node:path';
import { createSimApiApp } from '@apps/api/app/create-sim-api-app';
import { setApiPubSubOverride } from '@apps/api/sync/api-pubsub';
import { clientUnstableSettings } from '@apps/client/providers/client-root-layout';
import { createClientApp } from '@apps/client/providers/create-client-app';
import { jest } from '@jest/globals';
import type { Clock, Timers } from '@pkgs/clock';
import { wallClock } from '@pkgs/clock';
import { createHonoHttpClient, type HttpClient } from '@pkgs/http-client';
import type { Io, SimIo } from '@pkgs/io';
import {
  createInMemoryBus,
  type InMemoryBus,
} from '@pkgs/pubsub/testing/in-memory';
import type {
  InProcessSimulationSession,
  LiveNodeAdapter,
  SimTiming,
  SimulationStartContext,
  SimulationSystem,
  SimulationSystemHandle,
  TopologyDefinition,
} from '@pkgs/simulation';
import {
  createMeshedHttp,
  createSerializedHttp,
  createSimTiming,
  getCurrentSimNodeId,
  installSimGlobalFetch,
} from '@pkgs/simulation';
import { createRenderedAppFromRntl, type RenderedApp } from '@pkgs/ui-testing';
import { act, render } from '@testing-library/react-native';
import type BetterSqlite3 from 'better-sqlite3';
import { ExpoRoot } from 'expo-router';
import 'expo-router/testing-library';
import { createElement } from 'react';

import '@apps/client/i18n/i18n';

import {
  bootMigratedSimSqlite,
  SIM_SQLITE_DATABASE_URL,
  type SimSqliteHandle,
} from './boot-sim-sqlite';
import { createClientAppRouterContext } from './build-client-app-router-context';
import { clientSimTopology } from './client-sim-topology';
import {
  migrateSimSqlite,
  SIM_API_URL,
  SIM_BETTER_AUTH_SECRET,
} from './migrate-sim-sqlite';
import {
  createActorClientSeams,
  createActorIo,
  simNodeTimers,
} from './sim-actor-overrides';

const CLIENT_APP_DIR = path.resolve(
  __dirname,
  '../../../../apps/client/src/app'
);

type SimBackend = {
  readonly http: HttpClient;
  readonly db: SimSqliteHandle;
  readonly restoreGlobalFetch: () => void;
  readonly pubSubBus: InMemoryBus;
  readonly timing: SimTiming;
  readonly httpByNode: Map<string, HttpClient>;
};

const simWallClock: Clock = {
  now: () => wallClock.now(),
};

function isSimApiUrl(url: string): boolean {
  return url.startsWith(SIM_API_URL) || url.includes('://sim.local');
}

function createSimApiIo(base: SimIo): Io {
  return {
    ...base,
    clock: simWallClock,
    timers: simNodeTimers,
  };
}

async function bootSimBackend(
  io: SimIo,
  timing: SimTiming
): Promise<SimBackend> {
  const apiIo = createSimApiIo(io);
  const pubSubBus = createInMemoryBus();
  const httpByNode = new Map<string, HttpClient>();

  const dbStarted = wallClock.now();
  const { handle: db, didMigrate } = await bootMigratedSimSqlite({
    migrate: async (handle) => {
      await timing.time('boot.migrate', () =>
        migrateSimSqlite({
          sqlClient: handle.sqlClient,
          sqlite: handle.sqlite,
          io: apiIo,
        })
      );
    },
  });
  if (!didMigrate) {
    timing.mark('boot.migrate', 0);
    timing.mark('boot.sqlite', wallClock.now() - dbStarted);
  } else {
    timing.mark('boot.sqlite', 1);
  }

  try {
    const app = await timing.time('boot.createApi', () =>
      createSimApiApp({
        io: apiIo,
        openRequestDb: db.openRequestDb,
        pubSubBus,
        betterAuthSecret: SIM_BETTER_AUTH_SECRET,
        databaseUrl: SIM_SQLITE_DATABASE_URL,
        apiUrl: SIM_API_URL,
      })
    );
    const rawHttp = createHonoHttpClient({ app, origin: SIM_API_URL });
    await timing.time('boot.warm', async () => {
      const warm = await rawHttp.fetch(
        `${SIM_API_URL}/api/identity/anon/ensure`,
        {
          method: 'POST',
          headers: {
            'x-anon-id': '00000000-0000-4000-8000-0000000000aa',
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ forceNew: false }),
        }
      );
      if (!warm.ok) {
        throw new Error(
          `sim warm anon/ensure failed: ${warm.status} ${await warm.text()}`
        );
      }
      await warm.text();
    });
    const serialized = createSerializedHttp(rawHttp);
    const routerHttp: HttpClient = {
      fetch(input, init) {
        const nodeId = getCurrentSimNodeId();
        const client =
          (nodeId !== undefined ? httpByNode.get(nodeId) : undefined) ??
          serialized;
        return client.fetch(input, init);
      },
    };
    const restoreGlobalFetch = installSimGlobalFetch({
      http: routerHttp,
      isSimUrl: isSimApiUrl,
      getFetch: () => globalThis.fetch,
      setFetch: (next) => {
        globalThis.fetch = next;
      },
    });
    return {
      http: serialized,
      db,
      restoreGlobalFetch,
      pubSubBus,
      timing,
      httpByNode,
    };
  } catch (error) {
    await db.stop();
    throw error;
  }
}

function wrapRenderedApp(app: RenderedApp): RenderedApp {
  return {
    ...app,
    unmount: async () => {
      try {
        await app.unmount();
      } catch {
        // expo-router / DevMenu teardown can throw once Jest starts tearing down.
      }
    },
  };
}

const driverWait: {
  readonly now: () => number;
  readonly timers: Timers;
} = {
  now: () => {
    jest.useRealTimers();
    return wallClock.now();
  },
  timers: {
    setTimeout: (fn, ms) => {
      jest.useRealTimers();
      return simNodeTimers.setTimeout(fn, ms);
    },
    clearTimeout: (handle) => {
      simNodeTimers.clearTimeout(handle);
    },
    setInterval: (fn, ms) => {
      jest.useRealTimers();
      return simNodeTimers.setInterval(fn, ms);
    },
    clearInterval: (handle) => {
      simNodeTimers.clearInterval(handle);
    },
  },
};

const INITIAL_PATH = '/';

function neuterJestFakeTimers(): void {
  jest.useFakeTimers = ((..._args: unknown[]) =>
    jest) as typeof jest.useFakeTimers;
  jest.useRealTimers();
}

type SpawnClientArgs = {
  readonly ctx: SimulationStartContext;
  readonly backend: SimBackend;
  readonly actorSqliteRegistry: Map<string, BetterSqlite3.Database>;
  readonly nodeId: string;
};

function spawnClientAdapter(args: SpawnClientArgs): LiveNodeAdapter {
  const { ctx, backend, actorSqliteRegistry, nodeId } = args;
  const meshed = createMeshedHttp({
    from: nodeId,
    to: 'server',
    raw: backend.http,
    mesh: ctx.mesh,
    events: ctx.events,
  });
  backend.httpByNode.set(nodeId, meshed);

  let clockSkewMs = 0;
  const actorIo = createActorIo(ctx.io, meshed, () => clockSkewMs);
  const seams = createActorClientSeams({
    apiUrl: SIM_API_URL,
    pubSubBus: backend.pubSubBus,
    nodeId,
    ...(ctx.pubsub !== undefined ? { simPubSub: ctx.pubsub } : {}),
    onSqlite: (sqlite) => {
      if (sqlite === undefined) {
        actorSqliteRegistry.delete(nodeId);
        return;
      }
      actorSqliteRegistry.set(nodeId, sqlite);
    },
  });
  const clientApp = createClientApp({
    io: actorIo,
    overrides: seams.overrides,
  });

  const session: InProcessSimulationSession = {
    ui: 'in-process',
    driverWait,
    harness: {
      mount: () => mountClientApp({ backend, clientApp }),
    },
    async dispose() {
      actorSqliteRegistry.delete(nodeId);
      seams.disposeSqlite();
      backend.httpByNode.delete(nodeId);
    },
  };

  return buildClientNodeAdapter({
    session,
    nodeId,
    actorSqliteRegistry,
    seams,
    setClockSkewMs: (ms) => {
      clockSkewMs = ms;
    },
  });
}

async function mountClientApp(args: {
  readonly backend: SimBackend;
  readonly clientApp: ReturnType<typeof createClientApp>;
}): Promise<RenderedApp> {
  return args.backend.timing.time('mount', async () => {
    neuterJestFakeTimers();
    process.env['EXPO_ROUTER_IMPORT_MODE'] = 'sync';
    const context = createClientAppRouterContext(CLIENT_APP_DIR, {
      default: args.clientApp.RootLayout,
      unstable_settings: clientUnstableSettings,
    });
    const result = render(
      createElement(ExpoRoot, {
        context,
        location: INITIAL_PATH,
      })
    );
    jest.useRealTimers();
    await act(async () => {
      await Promise.resolve();
    });
    await new Promise<void>((resolve) => {
      simNodeTimers.setTimeout(resolve, 0);
    });
    await act(async () => {
      await Promise.resolve();
    });
    jest.useRealTimers();
    return wrapRenderedApp(createRenderedAppFromRntl(result));
  });
}

function buildClientNodeAdapter(args: {
  readonly session: InProcessSimulationSession;
  readonly nodeId: string;
  readonly actorSqliteRegistry: Map<string, BetterSqlite3.Database>;
  readonly seams: ReturnType<typeof createActorClientSeams>;
  readonly setClockSkewMs: (ms: number) => void;
}): LiveNodeAdapter {
  const { session, nodeId, actorSqliteRegistry, seams } = args;
  return {
    session,
    async snapshot(attr) {
      if (attr === 'sqlite') {
        const sqlite = actorSqliteRegistry.get(nodeId);
        if (!sqlite) return null;
        return {
          kind: 'sqlite',
          bytes: new Uint8Array(sqlite.serialize()),
        };
      }
      return null;
    },
    async crash() {
      await session.dispose();
    },
    async restart() {
      // Remount happens via a fresh spawn in scenarios; keep sqlite.
    },
    async dispose() {
      await session.dispose();
    },
    async corrupt(attr) {
      if (attr !== 'sqlite') return;
      const sqlite = actorSqliteRegistry.get(nodeId);
      if (!sqlite) return;
      sqlite.exec('PRAGMA user_version = 2147483647;');
    },
    async wipe(attr) {
      if (attr !== 'sqlite') return;
      seams.disposeSqlite();
      actorSqliteRegistry.delete(nodeId);
    },
    setClockSkewMs: args.setClockSkewMs,
  };
}

function spawnServerAdapter(args: {
  readonly backend: SimBackend;
}): LiveNodeAdapter {
  const { backend } = args;
  return {
    async snapshot(attr) {
      if (attr !== 'sqlite') return null;
      return {
        kind: 'sqlite',
        bytes: new Uint8Array(backend.db.sqlite.serialize()),
      };
    },
    async crash() {
      /* mesh partitions reject traffic */
    },
    async restart() {
      /* no-op */
    },
    async dispose() {
      /* backend stopped in system dispose */
    },
    async corrupt(attr) {
      if (attr !== 'sqlite') return;
      backend.db.sqlite.exec('PRAGMA user_version = 2147483647;');
    },
  };
}

function spawnBrokerAdapter(args: {
  readonly ctx: SimulationStartContext;
}): LiveNodeAdapter {
  const { ctx } = args;
  return {
    async snapshot() {
      return null;
    },
    async crash() {
      // Mesh edges to pubsub fail when scenarios partition; mark via events.
      ctx.events.append({ kind: 'node.crash', nodeId: 'pubsub' });
    },
    async restart() {
      ctx.events.append({ kind: 'node.restart', nodeId: 'pubsub' });
    },
    async dispose() {
      /* no-op */
    },
    silentDropSubscription(peerNodeId) {
      ctx.pubsub?.silentDrop(peerNodeId);
    },
    clearSilentDrop(peerNodeId) {
      ctx.pubsub?.clearSilentDrop(peerNodeId);
    },
    async redeliver(toNodeId) {
      await ctx.pubsub?.redeliver(toNodeId);
    },
  };
}

/**
 * In-process product simulation system for `@apps/client`.
 * GIVEN: fresh anon install on the home surface (Status bar → Account).
 */
export class ClientSimulationSystem implements SimulationSystem {
  readonly topology: TopologyDefinition = clientSimTopology;

  async start(ctx: SimulationStartContext): Promise<SimulationSystemHandle> {
    if (ctx.ui !== 'in-process') {
      throw new Error(
        'ClientSimulationSystem: only ui: in-process is supported'
      );
    }
    const timing = createSimTiming({ now: () => wallClock.now() });
    const backend = await bootSimBackend(ctx.io, timing);
    const actorSqliteRegistry = new Map<string, BetterSqlite3.Database>();
    const adapters = new Map<string, LiveNodeAdapter>();

    return {
      async spawn(node) {
        const existing = adapters.get(node.id);
        if (existing) return existing;

        let adapter: LiveNodeAdapter;
        if (node.kind === 'server') {
          adapter = spawnServerAdapter({ backend });
        } else if (node.kind === 'broker') {
          adapter = spawnBrokerAdapter({ ctx });
        } else if (node.kind === 'client') {
          adapter = spawnClientAdapter({
            ctx,
            backend,
            actorSqliteRegistry,
            nodeId: node.id,
          });
        } else {
          throw new Error(
            `ClientSimulationSystem: unknown kind '${node.kind}'`
          );
        }
        adapters.set(node.id, adapter);
        return adapter;
      },
      async dispose() {
        timing.finish('client-sim');
        for (const a of [...adapters.values()].reverse()) {
          await a.dispose();
        }
        adapters.clear();
        backend.restoreGlobalFetch();
        setApiPubSubOverride(undefined);
        actorSqliteRegistry.clear();
        await backend.db.stop();
      },
    };
  }
}
