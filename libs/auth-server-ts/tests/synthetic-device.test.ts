import { expect, test } from 'bun:test';
import { AuthApiRoutes } from '@libs/auth-server-ts/auth-routes';
import { AnonUserService } from '@libs/auth-shared-ts/anon-user-service';
import type { ApiHonoEnv } from '@libs/auth-shared-ts/api-hono-env';
import { appAuth } from '@libs/auth-shared-ts/auth-context';
import { SessionAuth } from '@libs/auth-shared-ts/session-middleware';
import { markSyntheticDevice } from '@libs/auth-shared-ts/synthetic-device';
import { AUTH_TABLES } from '@libs/auth-shared-ts/tables';
import type { AuthServerPort } from '@pkgs/auth-root-shared-ts/auth-server-port';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { createHarnessAdapters } from '@pkgs/uuid-shared-ts/harness-adapters';
import { Hono } from 'hono';

const TOKEN = 'synthetic-monitor-token-0123456789abcdef';
const DEVICE = '11111111-1111-4111-8111-111111111111';
const API = 'http://api.test';

const IDP: AuthServerPort = {
  provider: 'idp',
  verifySessionToken: async () => null,
  getUser: async () => null,
  deleteUser: async () => {},
};
const MONITORED: AuthServerPort = {
  ...IDP,
  isSyntheticMonitorCredential: async (presented) => presented === TOKEN,
};

async function withApi(
  authServer: AuthServerPort,
  run: (world: {
    readonly db: SqlClient;
    readonly ports: ReturnType<typeof createHarnessAdapters>;
    readonly mark: (token: string) => Promise<'marked' | 'unbound'>;
    readonly synthetic: () => Promise<boolean | undefined>;
  }) => Promise<void>
): Promise<void> {
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  try {
    await reconcileSqliteSchema(db, registerTables(AUTH_TABLES));
    const ports = createHarnessAdapters({ seed: 1 });
    const app = new Hono<ApiHonoEnv>()
      .use('*', async (c, next) => {
        c.set('sqlClient', db);
        c.set('authServer', authServer);
        await next();
      })
      .route('/api', new AuthApiRoutes(ports.clock, ports.createId).build());
    const http = {
      fetch: async (input: RequestInfo | URL, init?: RequestInit) =>
        app.request(String(input), init),
    };
    await run({
      db,
      ports,
      mark: (token) =>
        markSyntheticDevice({ http, apiOrigin: API, token, deviceId: DEVICE }),
      synthetic: async () =>
        appAuth(
          await new SessionAuth(authServer, ports).resolveAuthContext(
            db,
            new Request(`${API}/api/mutations`, {
              method: 'POST',
              headers: { 'x-anon-id': DEVICE },
            })
          )
        )?.synthetic,
    });
  } finally {
    await db.disconnect();
  }
}

// regression: synthetic-journey-packs-outlive-their-run
test("monitoring's credential marks the device's anonymous account, and its writes then carry synthetic provenance", async () => {
  await withApi(MONITORED, async ({ db, ports, mark, synthetic }) => {
    expect(await mark(TOKEN)).toBe('unbound');
    await new AnonUserService(db, ports).ensureForDevice({ deviceId: DEVICE });
    expect(await synthetic()).toBeUndefined();
    expect(await mark(TOKEN)).toBe('marked');
    expect(await synthetic()).toBe(true);
    const first = await db.query(
      sql<{ synthetic_at: string }>`SELECT synthetic_at FROM auth_users`
    );
    ports.clock.advance(60_000);
    expect(await mark(TOKEN)).toBe('marked');
    expect(
      await db.query(
        sql<{ synthetic_at: string }>`SELECT synthetic_at FROM auth_users`
      )
    ).toEqual(first);
  });
});

test('a person cannot mark their own account: a wrong credential, or none configured, is refused', async () => {
  await withApi(MONITORED, async ({ db, ports, mark, synthetic }) => {
    await new AnonUserService(db, ports).ensureForDevice({ deviceId: DEVICE });
    await expect(mark('guess')).rejects.toThrow('HTTP 401');
    await expect(mark('')).rejects.toThrow('HTTP 401');
    expect(await synthetic()).toBeUndefined();
  });
  await withApi(IDP, async ({ db, ports, mark, synthetic }) => {
    await new AnonUserService(db, ports).ensureForDevice({ deviceId: DEVICE });
    await expect(mark(TOKEN)).rejects.toThrow('HTTP 404');
    expect(await synthetic()).toBeUndefined();
  });
});

test('a signed-in account is never marked through its device', async () => {
  await withApi(MONITORED, async ({ db, ports, mark }) => {
    const users = new AnonUserService(db, ports);
    const user = await users.ensureForDevice({ deviceId: DEVICE });
    await users.clearUserAnonFlag(user.userId, ports.clock.now);
    expect(await mark(TOKEN)).toBe('unbound');
    expect(
      await db.query(
        sql<{
          id: string;
        }>`SELECT id FROM auth_users WHERE synthetic_at IS NOT NULL`
      )
    ).toEqual([]);
  });
});
