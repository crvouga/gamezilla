import { createAuthServerAdapter } from '@pkgs/auth-inhouse-server/create-auth-server-adapter';
import { reconcileIdpPostgres } from '@pkgs/auth-inhouse-server/reconcile-idp-postgres';
import { reconcileIdpSqlite } from '@pkgs/auth-inhouse-server/reconcile-idp-sqlite';
import type { Session } from '@pkgs/harness-shared/runtime-types';
import { SqlClientImplMockingbirdPostgres } from '@pkgs/sql-client-postgres-server/impl-mockingbird-postgres';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import { createPostgresDbScope } from '@pkgs/sql-client-shared/postgres-db-scope';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-shared/impl-mockingbird-sqlite';
import type { Hono } from 'hono';
import { idpForUrl, startIdpNodes } from './providers';
import {
  APPLE_CLIENT_ID,
  AUTH_SYSTEM_BASE_URL,
  AUTH_SYSTEM_PATH_PREFIX,
  AUTH_SYSTEM_SECRET,
  buildExampleApp,
} from './relying-party';
import type { AuthFabric, AuthStore } from './types';

function openSql(fabric: AuthFabric, seed: number): SqlClient {
  return fabric === 'mockingbird-sqlite'
    ? SqlClientImplMockingbirdSqlite.open({ seed })
    : SqlClientImplMockingbirdPostgres.open({ seed });
}

export async function migrateAuthSchema(
  fabric: AuthFabric,
  sqlClient: SqlClient
): Promise<void> {
  if (fabric === 'mockingbird-sqlite') {
    await reconcileIdpSqlite(sqlClient);
    return;
  }
  await reconcileIdpPostgres(sqlClient, {
    dbScope: createPostgresDbScope('public'),
    skipAdvisoryLock: true,
    alreadyInTransaction: false,
  });
}

export async function startStore(
  session: Session,
  opts: { readonly fabric: AuthFabric }
): Promise<AuthStore> {
  const { ports } = session;
  const seed = Math.floor(ports.rng.fork('sql').next() * 0xffffffff) || 1;
  const sql = openSql(opts.fabric, seed);
  await migrateAuthSchema(opts.fabric, sql);
  let app: Hono | null = null;
  const toApp = async (url: string, init?: RequestInit): Promise<Response> => {
    if (app === null) throw new Error('auth app is not up yet');
    return await app.request(url, init);
  };
  // The Apple node's notifications go to the auth app; nothing else is routable.
  const idps = await startIdpNodes({
    ports,
    egress: {
      fetch: (input, init) => toApp(String(input), init),
    },
  });
  const wire = async (url: string, init?: RequestInit): Promise<Response> => {
    const idp = idpForUrl(idps, url);
    return idp === null
      ? await toApp(url, init)
      : await idp.fetch(new Request(url, init));
  };
  // The auth app's own egress reaches the providers, and only them.
  app = await buildExampleApp(sql, ports, {
    async fetch(input, init) {
      const url = String(input);
      const idp = idpForUrl(idps, url);
      if (idp === null) return new Response('not found', { status: 404 });
      return await idp.fetch(new Request(url, init));
    },
  });
  return {
    fabric: opts.fabric,
    sql,
    server: createAuthServerAdapter({
      getSql: () => sql,
      clock: ports.clock,
      createId: ports.createId,
      secret: AUTH_SYSTEM_SECRET,
    }),
    idps,
    appleClientId: APPLE_CLIENT_ID,
    fetch: async (path, init) =>
      await wire(
        `${AUTH_SYSTEM_BASE_URL}${AUTH_SYSTEM_PATH_PREFIX}${path}`,
        init
      ),
    wire,
  };
}
