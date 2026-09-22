import {
  AuthPostgresDatabaseMigration,
  AuthSqliteDatabaseMigration,
} from '@pkgs/auth/server/auth-database-migration';
import { createAuthApp } from '@pkgs/auth/server/create-auth-app';
import { createAuthServerAdapter } from '@pkgs/auth/server/create-auth-server-adapter';
import type { HttpClient } from '@pkgs/http-client';
import { idpEndpoints } from '@pkgs/idp-sim/shared';
import { createNoopLogger } from '@pkgs/logger';
import type { Ports, Session } from '@pkgs/sim';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres-db-scope';
import { SqlClientImplPostgresMem } from '@pkgs/sql-client-postgres/impl-postgres-mem';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client-sqlite/impl-sqlite-mem';
import { Hono } from 'hono';

import {
  APPLE_CLIENT_ID,
  appleRelyingPartyConfig,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_ORIGIN,
  idpForUrl,
  startIdpNodes,
} from './idp-node';
import {
  AUTH_SYSTEM_BASE_URL,
  AUTH_SYSTEM_PATH_PREFIX,
  AUTH_SYSTEM_SECRET,
  AUTH_SYSTEM_TRUSTED_ORIGINS,
  type AuthFabric,
  type AuthStore,
} from './types';

function openSql(fabric: AuthFabric, seed: number): SqlClient {
  return fabric === 'sqlite-mem'
    ? SqlClientImplSqliteMem.open({ seed })
    : SqlClientImplPostgresMem.open({ seed });
}

export async function migrateAuthSchema(
  fabric: AuthFabric,
  sqlClient: SqlClient
): Promise<void> {
  const logger = createNoopLogger();
  if (fabric === 'sqlite-mem') {
    await new AuthSqliteDatabaseMigration().migrate({ sqlClient, logger });
    return;
  }
  await new AuthPostgresDatabaseMigration({
    dbScope: createPostgresDbScope('public'),
    skipAdvisoryLock: true,
    alreadyInTransaction: false,
  }).migrate({ sqlClient, logger });
}

/** Mounted under `/api`, as the product's API worker mounts it. */
async function buildAuthApp(
  sql: SqlClient,
  ports: Ports,
  egress: HttpClient
): Promise<Hono> {
  const authApp = createAuthApp({
    getSql: () => sql,
    clock: ports.clock,
    createId: ports.createId,
    http: egress,
    secret: AUTH_SYSTEM_SECRET,
    baseURL: AUTH_SYSTEM_BASE_URL,
    publicPathPrefix: AUTH_SYSTEM_PATH_PREFIX,
    trustedOrigins: AUTH_SYSTEM_TRUSTED_ORIGINS,
    providers: {
      google: {
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        endpoints: idpEndpoints(GOOGLE_ORIGIN),
      },
      apple: await appleRelyingPartyConfig(),
    },
  });
  return new Hono().route(AUTH_SYSTEM_PATH_PREFIX, authApp);
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
      : await idp.app.fetch(new Request(url, init));
  };
  // The auth app's own egress reaches the providers, and only them.
  app = await buildAuthApp(sql, ports, {
    async fetch(input, init) {
      const url = String(input);
      const idp = idpForUrl(idps, url);
      if (idp === null) return new Response('not found', { status: 404 });
      return await idp.app.fetch(new Request(url, init));
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
