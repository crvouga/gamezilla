/**
 * Product {@link SimulationSystem} for `@apps/client`: boots in-process
 * pg-mem, migrates it, mounts the real API via Hono, and hands each actor an
 * isolated client stack rendered through Expo Router's testing library + RNTL.
 */

import path from 'node:path';
import {
  clearInterval as nodeClearInterval,
  clearTimeout as nodeClearTimeout,
  setInterval as nodeSetInterval,
  setTimeout as nodeSetTimeout,
} from 'node:timers';
import { createApiApp } from '@apps/api/app/create-app';
import { loadBetterAuthBootConfig } from '@apps/api/config/better-auth-boot';
import { setApiPubSubOverride } from '@apps/api/sync/api-pubsub';
import { appPostgresDbScope } from '@libs/infra/namespace-bindings';
import { createInMemoryStripe } from '@libs/stripe/in-memory-stripe';
import type { Clock, Timers } from '@pkgs/clock';
import { wallClock } from '@pkgs/clock';
import { createHonoHttpClient, type HttpClient } from '@pkgs/http-client';
import type { Io, SimIo } from '@pkgs/io';
import { InMemoryLlmProvider } from '@pkgs/llm/server';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import { createNoopObservability } from '@pkgs/observability/impl-noop/impl-noop';
import {
  createInMemoryBus,
  createInMemoryPublishOnlyPubSub,
} from '@pkgs/pubsub/testing/in-memory';
import { createRecordSecretStore } from '@pkgs/secret-store/record-secret-store';
import type {
  InProcessSimulationSession,
  SimulationStartContext,
  SimulationSystem,
  SimulationSystemHandle,
} from '@pkgs/simulation';
import { InMemoryTtsProvider } from '@pkgs/tts/server';
import { createRenderedAppFromRntl, type RenderedApp } from '@pkgs/ui-testing';
import { act, render } from '@testing-library/react-native';
import { ExpoRoot } from 'expo-router';
// Side-effect: jest mocks / expect matchers used by expo-router tests.
import 'expo-router/testing-library';
import { createElement } from 'react';

import {
  bootPgMem,
  PG_MEM_DATABASE_URL,
  type PgMemHandle,
} from './boot-pg-mem';
import { createClientAppRouterContext } from './build-client-app-router-context';
import {
  migrateSimDb,
  SIM_API_URL,
  SIM_BETTER_AUTH_SECRET,
} from './migrate-sim-db';
import { createActorClientSeams, createActorIo } from './sim-actor-overrides';
import { SimRootLayout, simUnstableSettings } from './sim-root';

/** Absolute path to the real Expo Router `app/` tree. */
const CLIENT_APP_DIR = path.resolve(
  __dirname,
  '../../../../apps/client/src/app'
);

type SimBackend = {
  readonly http: HttpClient;
  readonly pgMem: PgMemHandle;
  readonly restoreGlobalFetch: () => void;
  readonly pubSubBus: ReturnType<typeof createInMemoryBus>;
};

/**
 * Jest-immune wall timers for the sim harness. `wallTimers` uses
 * `globalThis.setTimeout`, which Jest fakes after `renderRouter` — that
 * strands Better Auth session races (`EXISTING_SESSION_CHECK_MS`) and leaves
 * SignInModal on "Signing in…".
 */
const simNodeTimers: Timers = {
  setTimeout: (fn, ms) => nodeSetTimeout(fn, ms),
  clearTimeout: (handle) => {
    nodeClearTimeout(handle as ReturnType<typeof nodeSetTimeout>);
  },
  setInterval: (fn, ms) => nodeSetInterval(fn, ms),
  clearInterval: (handle) => {
    nodeClearInterval(handle as ReturnType<typeof nodeSetInterval>);
  },
};

const simWallClock: Clock = {
  now: () => wallClock.now(),
};

function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function isSimApiUrl(url: string): boolean {
  return url.startsWith(SIM_API_URL) || url.includes('://sim.local');
}

/**
 * Serialize in-process Hono fetches. Overlapping pg-mem work under the
 * React/Jest zone hangs; sequential requests succeed.
 *
 * Re-entrant fetch (a handler/plugin calling fetch while one is already
 * in-flight on this client) must NOT wait on `chain` — that deadlocks
 * sign-up (signUp.email → nested getSession) and leaves SignInModal on
 * "Signing in…".
 */
function createSerializedHttp(rawHttp: HttpClient): HttpClient {
  let chain: Promise<unknown> = Promise.resolve();
  let active = 0;
  return {
    fetch(input, init) {
      if (active > 0) {
        active += 1;
        return rawHttp.fetch(input, init).finally(() => {
          active -= 1;
        });
      }
      const next = chain.then(async () => {
        active += 1;
        try {
          return await rawHttp.fetch(input, init);
        } finally {
          active -= 1;
        }
      });
      chain = next.then(
        () => undefined,
        () => undefined
      );
      return next;
    },
  };
}

/**
 * Better Auth / better-fetch may still reach `globalThis.fetch` (default
 * `customFetchImpl` or plugin paths). Divert sim API URLs into the in-process
 * Hono client so sign-up never opens real sockets to `sim.local`.
 */
function installSimGlobalFetch(http: HttpClient): () => void {
  const previous = globalThis.fetch.bind(globalThis);
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = resolveRequestUrl(input);
    if (isSimApiUrl(url)) {
      return http.fetch(input, init);
    }
    return previous(input, init);
  }) as typeof fetch;
  return () => {
    globalThis.fetch = previous;
  };
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

/** Boots pg-mem + migrates + mounts the in-process API, returning its HTTP. */
async function bootSimBackend(io: SimIo): Promise<SimBackend> {
  const pgMem = await bootPgMem();
  const pubSubBus = createInMemoryBus();
  const apiIo = createSimApiIo(io);

  try {
    await migrateSimDb({
      sqlClient: pgMem.sqlClient,
      pool: pgMem.pool,
      io: apiIo,
    });
    const secretStore = createRecordSecretStore({
      BETTER_AUTH_SECRET: SIM_BETTER_AUTH_SECRET,
      DATABASE_URL: PG_MEM_DATABASE_URL,
      API_URL: SIM_API_URL,
    });
    const betterAuth = await loadBetterAuthBootConfig({
      secretStore,
      apiUrlOverride: SIM_API_URL,
      secretsEnv: 'dev',
    });
    const app = await createApiApp({
      io: apiIo,
      secretStore,
      betterAuth,
      dbScope: appPostgresDbScope(),
      databaseUrlOverride: PG_MEM_DATABASE_URL,
      apiUrlOverride: SIM_API_URL,
      openRequestDb: pgMem.openRequestDb,
      secretsEnv: 'dev',
      objectStore: new ObjectStoreImplInMemory(),
      observability: createNoopObservability('sim-api'),
      stripe: createInMemoryStripe({ baseUrl: SIM_API_URL }),
      llmProvider: new InMemoryLlmProvider(),
      ttsProvider: new InMemoryTtsProvider(),
      pubSub: createInMemoryPublishOnlyPubSub(pubSubBus),
    });
    const rawHttp = createHonoHttpClient({ app, origin: SIM_API_URL });
    // Warm client_config materialize outside React so the first AuthBridge
    // request does not enter the upsert transaction (hangs under Jest+RNTL).
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
    const http = createSerializedHttp(rawHttp);
    const restoreGlobalFetch = installSimGlobalFetch(http);
    return {
      http,
      pgMem,
      restoreGlobalFetch,
      pubSubBus,
    };
  } catch (error) {
    await pgMem.stop();
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

function createActorSession(
  io: SimIo,
  http: HttpClient,
  pubSubBus: ReturnType<typeof createInMemoryBus>
): InProcessSimulationSession {
  const actorIo = createActorIo(io, http);
  const { overrides } = createActorClientSeams({
    apiUrl: SIM_API_URL,
    pubSubBus,
  });
  return {
    ui: 'in-process',
    driverWait,
    harness: {
      async mount() {
        // expo-router's renderRouter always calls jest.useFakeTimers(). That
        // breaks in-process Hono + pg-mem (query completions / AuthBridge
        // ensureAnon hang once timers are faked). Keep the noop for the
        // actor lifetime — product Io uses node:timers anyway.
        jest.useFakeTimers = ((..._args: unknown[]) =>
          jest) as typeof jest.useFakeTimers;
        jest.useRealTimers();
        // Full product `app/` filesystem context; only root `_layout` is
        // replaced for sim Io / AppOverrides. Never stub individual screens.
        process.env['EXPO_ROUTER_IMPORT_MODE'] = 'sync';
        const context = createClientAppRouterContext(CLIENT_APP_DIR, {
          default: () =>
            createElement(SimRootLayout, {
              io: actorIo,
              overrides,
            }),
          unstable_settings: simUnstableSettings,
        });
        const result = render(
          createElement(ExpoRoot, {
            context,
            location: INITIAL_PATH,
          })
        );
        jest.useRealTimers();
        // Let AuthBridge / sync microtasks and macrotasks land, then flush
        // RNTL so local SQL watches (e.g. client_config → email sign-in)
        // commit before the scenario starts polling.
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
      },
    },
    async dispose() {
      // Actor client state lives in the discarded React tree + memory SQLite.
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
    const backend = await bootSimBackend(ctx.io);
    return {
      async createSession(_actorId: string) {
        return createActorSession(ctx.io, backend.http, backend.pubSubBus);
      },
      async dispose() {
        backend.restoreGlobalFetch();
        setApiPubSubOverride(undefined);
        await backend.pgMem.stop();
      },
    };
  }
}
