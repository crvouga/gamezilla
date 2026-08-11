/**
 * Product {@link SimulationSystem} for `@apps/client`: boots in-process
 * pg-mem, migrates it, mounts the real API via Hono, and hands each actor an
 * isolated client stack rendered through Expo Router's testing library + RNTL.
 */

import { createApiApp } from '@apps/api/app/create-app';
import { loadBetterAuthBootConfig } from '@apps/api/config/better-auth-boot';
import { appPostgresDbScope } from '@libs/infra/namespace-bindings';
import { wallTimers } from '@pkgs/clock';
import { createHonoHttpClient, type HttpClient } from '@pkgs/http-client';
import type { SimIo } from '@pkgs/io';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import { createNoopObservability } from '@pkgs/observability/impl-noop/impl-noop';
import { createRecordSecretStore } from '@pkgs/secret-store/record-secret-store';
import type {
  InProcessSimulationSession,
  SimulationStartContext,
  SimulationSystem,
  SimulationSystemHandle,
} from '@pkgs/simulation';
import { createRenderedAppFromRntl, type RenderedApp } from '@pkgs/ui-testing';
import { act } from '@testing-library/react-native';
import { type Href, router } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { createElement } from 'react';

import {
  bootPgMem,
  PG_MEM_DATABASE_URL,
  type PgMemHandle,
} from './boot-pg-mem';
import {
  migrateSimDb,
  SIM_API_URL,
  SIM_BETTER_AUTH_SECRET,
} from './migrate-sim-db';
import { createActorClientSeams, createActorIo } from './sim-actor-overrides';
import { SimAccountScreen, SimLayout, SimSpacesHome } from './sim-root';

type SimBackend = {
  readonly http: HttpClient;
  readonly pgMem: PgMemHandle;
  readonly restoreGlobalFetch: () => void;
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
 */
function createSerializedHttp(rawHttp: HttpClient): HttpClient {
  let chain: Promise<unknown> = Promise.resolve();
  return {
    fetch(input, init) {
      const next = chain.then(() => rawHttp.fetch(input, init));
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

/** Boots pg-mem + migrates + mounts the in-process API, returning its HTTP. */
async function bootSimBackend(io: SimIo): Promise<SimBackend> {
  const pgMem = await bootPgMem();

  try {
    await migrateSimDb({
      sqlClient: pgMem.sqlClient,
      pool: pgMem.pool,
      io,
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
      io,
      secretStore,
      betterAuth,
      dbScope: appPostgresDbScope(),
      databaseUrlOverride: PG_MEM_DATABASE_URL,
      apiUrlOverride: SIM_API_URL,
      openRequestDb: pgMem.openRequestDb,
      secretsEnv: 'dev',
      objectStore: new ObjectStoreImplInMemory(),
      observability: createNoopObservability('sim-api'),
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
    };
  } catch (error) {
    await pgMem.stop();
    throw error;
  }
}

function wrapRenderedApp(app: RenderedApp): RenderedApp {
  return {
    ...app,
    unmount: () => {
      try {
        app.unmount();
      } catch {
        // expo-router / DevMenu teardown can throw once Jest starts tearing down.
      }
    },
  };
}

function createActorSession(
  io: SimIo,
  http: HttpClient,
  initialPath: string
): InProcessSimulationSession {
  const actorIo = createActorIo(io, http);
  const { overrides } = createActorClientSeams(SIM_API_URL);
  let path = initialPath;
  return {
    ui: 'in-process',
    harness: {
      async mount() {
        // expo-router's renderRouter always calls jest.useFakeTimers(). That
        // breaks in-process Hono + pg-mem (query completions / AuthBridge
        // ensureAnon hang once timers are faked). Keep real timers for sims.
        const useFakeTimers = jest.useFakeTimers.bind(jest);
        jest.useFakeTimers = ((..._args: unknown[]) =>
          jest) as typeof jest.useFakeTimers;
        let result: ReturnType<typeof renderRouter>;
        try {
          result = renderRouter(
            {
              _layout: () =>
                createElement(SimLayout, { io: actorIo, overrides }),
              index: () => createElement(SimSpacesHome),
              'more/account': () => createElement(SimAccountScreen),
            },
            { initialUrl: path }
          );
        } finally {
          jest.useFakeTimers = useFakeTimers;
        }
        jest.useRealTimers();
        // Let AuthBridge / sync microtasks and macrotasks land before the
        // scenario starts polling (fake timers may have been left on by
        // nested expo-router helpers).
        await act(async () => {
          await Promise.resolve();
        });
        await new Promise<void>((resolve) => {
          wallTimers.setTimeout(resolve, 0);
        });
        jest.useRealTimers();
        return wrapRenderedApp(createRenderedAppFromRntl(result));
      },
    },
    async open(nextPath: string) {
      path = nextPath;
      jest.useRealTimers();
      act(() => {
        router.push(nextPath as Href);
      });
      jest.useRealTimers();
    },
    async dispose() {
      // Actor client state lives in the discarded React tree + memory SQLite.
    },
  };
}

/** In-process product simulation system for the client login/logout scenario. */
export function createClientSimulationSystem(): SimulationSystem {
  return {
    async start(ctx: SimulationStartContext): Promise<SimulationSystemHandle> {
      if (ctx.ui !== 'in-process') {
        throw new Error(
          'createClientSimulationSystem: only ui: in-process is supported'
        );
      }
      const backend = await bootSimBackend(ctx.io);
      return {
        async createSession(_actorId: string) {
          return createActorSession(ctx.io, backend.http, '/more/account');
        },
        async dispose() {
          backend.restoreGlobalFetch();
          await backend.pgMem.stop();
        },
      };
    },
  };
}
