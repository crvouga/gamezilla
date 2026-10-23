import { expect, test } from 'bun:test';
import { createServer } from '@libs/app-root-server-ts/create-server';
import type { ServerEnv } from '@libs/app-root-shared-ts/server-env';
import { shippedModerationRules } from '@libs/moderation-shared-ts/moderation-rules';
import {
  explicitRouteGroup,
  ROUTE_GROUPS,
  routeGroupOf,
} from '@libs/observability-shared-ts/route-groups';
import { APP_AUTH_PROVIDER } from '@libs/runtime-server-ts/app-auth-provider';
import { appSubServers } from '@libs/runtime-server-ts/app-sub-servers';
import { APP } from '@libs/runtime-shared-ts/app-subs';
import { composeSubServers } from '@libs/sub-shared-ts/compose-server';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import { createRecordSecretStore } from '@pkgs/secret-store-shared-ts/record-secret-store';

/**
 * The API as the product composes it, every sub mounted, and nothing behind
 * it: no database is opened until a request needs one.
 */
const noRooms: Parameters<typeof appSubServers>[0]['rooms'] = {
  read: () => Promise.reject(new Error('no rooms in this test')),
  setAvailability: () => Promise.reject(new Error('no rooms in this test')),
  send: () => Promise.reject(new Error('no rooms in this test')),
  disconnect: () => Promise.reject(new Error('no rooms in this test')),
  eraseIdentity: () => Promise.reject(new Error('no rooms in this test')),
};

async function mountedRoutes(): Promise<readonly string[]> {
  const { clock, timers } = createHarnessClock({ startMs: 0 });
  let ids = 0;
  const env: ServerEnv = {
    clock,
    timers,
    createId: () => `id-${++ids}`,
    random: () => 0.5,
    seed: 1n,
    openSqlClient: () => Promise.reject(new Error('no database in this test')),
    events: null,
    kv: null,
    blob: new ObjectStoreImplInMemory(),
    billing: null,
    tts: null,
    llm: null,
    secrets: createRecordSecretStore({
      DATABASE_URL: 'postgresql://example.test/none',
      API_URL: 'https://api.example.test',
      AUTH_SECRET: 'a'.repeat(48),
    }),
    auth: APP_AUTH_PROVIDER,
    moderation: shippedModerationRules(),
    protection: 'standard',
    serverUrl: 'https://api.example.test',
    skipDatabaseUrlPolicy: true,
    fetch: () => Promise.reject(new Error('no network in this test')),
  };
  const server = await createServer(env, {
    app: APP,
    servers: composeSubServers(
      appSubServers({ billing: null, rooms: noRooms })
    ),
  });
  return [...new Set(server.routes.map((route) => route.path))].sort();
}

const routes = await mountedRoutes();

// regression: http-metrics-machine-traffic-unseparated
test('every route the API mounts has a route group of its own, so no new route is counted by default', () => {
  // The catch-all is middleware (CORS, request telemetry), not a route.
  const answering = routes.filter((route) => route !== '/api/*');
  expect(answering.length).toBeGreaterThan(30);
  expect(
    answering.filter((route) => explicitRouteGroup(route) === null)
  ).toEqual([]);
});

test('machines are kept apart from people on the routes only machines call', () => {
  const machine = routes.filter((route) => routeGroupOf(route) === 'machine');
  expect(machine).toContain('/api/health');
  expect(machine).toContain('/api/synthetic-population-worker/claim');
  expect(routes.filter((r) => routeGroupOf(r) === 'telemetry')).toEqual([
    '/api/observability/v1/:signal',
  ]);
  for (const group of ROUTE_GROUPS) {
    // Every group has a route today, so a rule that stops matching is noticed.
    expect(routes.some((route) => routeGroupOf(route) === group)).toBe(true);
  }
});
