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
import { createInMemoryBus } from '@pkgs/pubsub/testing/in-memory';
import type {
  InProcessSimulationSession,
  SimTiming,
  SimulationSqliteNodeSnapshot,
  SimulationStartContext,
  SimulationSystem,
  SimulationSystemHandle,
} from '@pkgs/simulation';
import {
  createSerializedHttp,
  createSimTiming,
  installSimGlobalFetch,
} from '@pkgs/simulation';
import { createRenderedAppFromRntl, type RenderedApp } from '@pkgs/ui-testing';
import { act, render } from '@testing-library/react-native';
import type BetterSqlite3 from 'better-sqlite3';
import { ExpoRoot } from 'expo-router';
// Side-effect: jest mocks / expect matchers used by expo-router tests.
import 'expo-router/testing-library';
import { createElement } from 'react';

import '@apps/client/i18n/i18n';

import {
  bootMigratedSimSqlite,
  SIM_SQLITE_DATABASE_URL,
  type SimSqliteHandle,
} from './boot-sim-sqlite';
import { createClientAppRouterContext } from './build-client-app-router-context';
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

/** Absolute path to the real Expo Router `app/` tree. */
const CLIENT_APP_DIR = path.resolve(
  __dirname,
  '../../../../apps/client/src/app'
);

type SimBackend = {
  readonly http: HttpClient;
  readonly db: SimSqliteHandle;
  readonly restoreGlobalFetch: () => void;
  readonly pubSubBus: ReturnType<typeof createInMemoryBus>;
  readonly timing: SimTiming;
};

const simWallClock: Clock = {
  now: () => wallClock.now(),
};

function isSimApiUrl(url: string): boolean {
  return url.startsWith(SIM_API_URL) || url.includes('://sim.local');
}

/**
 * API Io shares sim ids/rng but uses wall clock/timers so Better Auth session
 * expiry lines up with the actor client (also wall). A frozen sim clock at
 * `startMs` (2024) against a 2026 wall client marks sessions expired.
 */
function createSimApiIo(base: SimIo): Io {
  return {
    ...base,
    clock: simWallClock,
    timers: simNodeTimers,
  };
}

/** Boots SQLite + migrates + mounts the in-process API, returning its HTTP. */
async function bootSimBackend(
  io: SimIo,
  timing: SimTiming
): Promise<SimBackend> {
  const apiIo = createSimApiIo(io);
  const pubSubBus = createInMemoryBus();

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
    // Migrate owns first-boot DB cost; sqlite open is connect-only.
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
    // Warm client_config materialize outside React so the first AuthBridge
    // request does not enter the upsert transaction (hangs under Jest+RNTL).
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
    const http = createSerializedHttp(rawHttp);
    const restoreGlobalFetch = installSimGlobalFetch({
      http,
      isSimUrl: isSimApiUrl,
      getFetch: () => globalThis.fetch,
      setFetch: (next) => {
        globalThis.fetch = next;
      },
    });
    return {
      http,
      db,
      restoreGlobalFetch,
      pubSubBus,
      timing,
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

/**
 * Driver wait polling must use wall Node timers (not SimClock) so real HTTP /
 * AuthBridge work can complete. Also force Jest real timers — expo-router /
 * RNTL occasionally re-enable fakes mid-scenario.
 */
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

/** Home surface — Account is reached via Status bar (user-visible). */
const INITIAL_PATH = '/';

/**
 * Neutered once for the process: expo-router's renderRouter always calls
 * jest.useFakeTimers(), which strands in-process Hono + SQLite.
 */
function neuterJestFakeTimers(): void {
  jest.useFakeTimers = ((..._args: unknown[]) =>
    jest) as typeof jest.useFakeTimers;
  jest.useRealTimers();
}

type CreateActorSessionArgs = {
  readonly io: SimIo;
  readonly http: HttpClient;
  readonly pubSubBus: ReturnType<typeof createInMemoryBus>;
  readonly timing: SimTiming;
  readonly actorSqliteRegistry: Map<string, BetterSqlite3.Database>;
  readonly actorId: string;
};

function createActorSession(
  args: CreateActorSessionArgs
): InProcessSimulationSession {
  const { io, http, pubSubBus, timing, actorSqliteRegistry, actorId } = args;
  const actorIo = createActorIo(io, http);
  const seams = createActorClientSeams({
    apiUrl: SIM_API_URL,
    pubSubBus,
    onSqlite: (sqlite) => {
      if (sqlite === undefined) {
        actorSqliteRegistry.delete(actorId);
        return;
      }
      actorSqliteRegistry.set(actorId, sqlite);
    },
  });
  const clientApp = createClientApp({
    io: actorIo,
    overrides: seams.overrides,
  });
  return {
    ui: 'in-process',
    driverWait,
    harness: {
      async mount() {
        return timing.time('mount', async () => {
          neuterJestFakeTimers();
          // Full product `app/` filesystem context; only root `_layout` is
          // replaced for sim Io / AppOverrides. Never stub individual screens.
          process.env['EXPO_ROUTER_IMPORT_MODE'] = 'sync';
          const context = createClientAppRouterContext(CLIENT_APP_DIR, {
            default: clientApp.RootLayout,
            unstable_settings: clientUnstableSettings,
          });
          const result = render(
            createElement(ExpoRoot, {
              context,
              location: INITIAL_PATH,
            })
          );
          jest.useRealTimers();
          // Let AuthBridge / sync microtasks land, then flush RNTL so local
          // SQL watches (e.g. client_config → email sign-in) commit.
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
      },
    },
    async dispose() {
      actorSqliteRegistry.delete(actorId);
      seams.disposeSqlite();
    },
  };
}

/**
 * In-process product simulation system for `@apps/client`.
 * GIVEN: fresh anon install on the home surface (Status bar → Account).
 */
export class ClientSimulationSystem implements SimulationSystem {
  async start(ctx: SimulationStartContext): Promise<SimulationSystemHandle> {
    if (ctx.ui !== 'in-process') {
      throw new Error(
        'ClientSimulationSystem: only ui: in-process is supported'
      );
    }
    const timing = createSimTiming({ now: () => wallClock.now() });
    const backend = await bootSimBackend(ctx.io, timing);
    const actorSqliteRegistry = new Map<string, BetterSqlite3.Database>();
    return {
      async createSession(actorId: string) {
        return createActorSession({
          io: ctx.io,
          http: backend.http,
          pubSubBus: backend.pubSubBus,
          timing,
          actorSqliteRegistry,
          actorId,
        });
      },
      async snapshotDatabases(): Promise<
        readonly SimulationSqliteNodeSnapshot[]
      > {
        const nodes: SimulationSqliteNodeSnapshot[] = [
          {
            nodeId: 'server',
            bytes: new Uint8Array(backend.db.sqlite.serialize()),
          },
        ];
        for (const [actorId, sqlite] of actorSqliteRegistry) {
          nodes.push({
            nodeId: actorId,
            bytes: new Uint8Array(sqlite.serialize()),
          });
        }
        return nodes;
      },
      async dispose() {
        timing.finish('client-sim');
        backend.restoreGlobalFetch();
        setApiPubSubOverride(undefined);
        actorSqliteRegistry.clear();
        await backend.db.stop();
      },
    };
  }
}
