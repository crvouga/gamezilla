import {
  AuthPostgresDatabaseMigration,
  AuthSqliteDatabaseMigration,
} from '@pkgs/auth/server/auth-database-migration';
import { createAuthApp } from '@pkgs/auth/server/create-auth-app';
import { createAuthServerAdapter } from '@pkgs/auth/server/create-auth-server-adapter';
import type { GoogleIdp } from '@pkgs/idp-google-sim/server';
import { idpEndpoints } from '@pkgs/idp-google-sim/shared';
import { createNoopLogger } from '@pkgs/logger';
import type { Ports, Session } from '@pkgs/sim';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres-db-scope';
import { SqlClientImplPostgresMem } from '@pkgs/sql-client-postgres/impl-postgres-mem';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client-sqlite/impl-sqlite-mem';
import {
  createIdpHttpClient,
  IDP_CLIENT_ID,
  IDP_CLIENT_SECRET,
  IDP_ORIGIN,
  startIdpNode,
} from './idp-node';
import {
  type ActorState,
  AUTH_SYSTEM_BASE_URL,
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

const GOOGLE_REDIRECT_URI = `${AUTH_SYSTEM_BASE_URL}/auth/callback/google`;

function buildStore(args: {
  readonly fabric: AuthFabric;
  readonly sql: SqlClient;
  readonly ports: Ports;
  readonly idp: GoogleIdp;
}): AuthStore {
  const { fabric, sql, ports, idp } = args;
  const app = createAuthApp({
    getSql: () => sql,
    clock: ports.clock,
    createId: ports.createId,
    http: createIdpHttpClient(idp),
    secret: AUTH_SYSTEM_SECRET,
    baseURL: AUTH_SYSTEM_BASE_URL,
    trustedOrigins: AUTH_SYSTEM_TRUSTED_ORIGINS,
    providers: {
      google: {
        clientId: IDP_CLIENT_ID,
        clientSecret: IDP_CLIENT_SECRET,
        endpoints: idpEndpoints(IDP_ORIGIN),
      },
    },
  });
  const server = createAuthServerAdapter({
    getSql: () => sql,
    clock: ports.clock,
    createId: ports.createId,
    secret: AUTH_SYSTEM_SECRET,
  });
  const wire = async (url: string, init?: RequestInit): Promise<Response> =>
    url.startsWith(IDP_ORIGIN)
      ? idp.app.fetch(new Request(url, init))
      : app.request(url, init);
  return {
    fabric,
    sql,
    server,
    idp,
    fetch: async (path, init) =>
      app.request(`${AUTH_SYSTEM_BASE_URL}${path}`, init),
    wire,
  };
}

export async function startStore(
  session: Session,
  opts: { readonly fabric: AuthFabric }
): Promise<AuthStore> {
  const seed =
    Math.floor(session.ports.rng.fork('sql').next() * 0xffffffff) || 1;
  const sql = openSql(opts.fabric, seed);
  await migrateAuthSchema(opts.fabric, sql);
  const idp = await startIdpNode({
    ports: session.ports,
    redirectUri: GOOGLE_REDIRECT_URI,
  });
  return buildStore({ fabric: opts.fabric, sql, ports: session.ports, idp });
}

export function startActor(): ActorState {
  return {
    bearer: null,
    pendingAuthUrl: null,
    pendingCode: null,
  };
}
