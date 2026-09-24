import {
  AuthPostgresDatabaseMigration,
  AuthSqliteDatabaseMigration,
} from '@pkgs/auth/server/auth-database-migration';
import { createAuthApp } from '@pkgs/auth/server/create-auth-app';
import { createAuthServerAdapter } from '@pkgs/auth/server/create-auth-server-adapter';
import { createNoopLogger } from '@pkgs/logger';
import type { Ports, Session } from '@pkgs/sim';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres-db-scope';
import { SqlClientImplMockingbirdPostgres } from '@pkgs/sql-client-postgres/impl-mockingbird-postgres';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite/impl-mockingbird-sqlite';
import { createMockingbirdGoogle } from './mockingbird-google';
import {
  type ActorState,
  AUTH_SYSTEM_BASE_URL,
  AUTH_SYSTEM_GOOGLE_CLIENT,
  AUTH_SYSTEM_SECRET,
  AUTH_SYSTEM_SUBJECTS,
  AUTH_SYSTEM_TRUSTED_ORIGINS,
  type AuthFabric,
  type AuthStore,
} from './types';

function openSql(fabric: AuthFabric, seed: number): SqlClient {
  return fabric === 'mockingbird-sqlite'
    ? SqlClientImplMockingbirdSqlite.open({ seed })
    : SqlClientImplMockingbirdPostgres.open({ seed });
}

export async function migrateAuthSchema(
  fabric: AuthFabric,
  sqlClient: SqlClient
): Promise<void> {
  const logger = createNoopLogger();
  if (fabric === 'mockingbird-sqlite') {
    await new AuthSqliteDatabaseMigration().migrate({ sqlClient, logger });
    return;
  }
  await new AuthPostgresDatabaseMigration({
    dbScope: createPostgresDbScope('public'),
    skipAdvisoryLock: true,
    alreadyInTransaction: false,
  }).migrate({ sqlClient, logger });
}

function buildStore(args: {
  readonly fabric: AuthFabric;
  readonly sql: SqlClient;
  readonly ports: Ports;
  readonly enableDev: boolean;
  readonly enableGoogle: boolean;
}): AuthStore {
  const { fabric, sql, ports } = args;
  const google = createMockingbirdGoogle({
    ...AUTH_SYSTEM_GOOGLE_CLIENT,
    clock: ports.clock,
    redirectUri: `${AUTH_SYSTEM_BASE_URL}/auth/callback/google`,
    subjects: AUTH_SYSTEM_SUBJECTS,
  });
  const app = createAuthApp({
    getSql: () => sql,
    clock: ports.clock,
    createId: ports.createId,
    http: google.http,
    secret: AUTH_SYSTEM_SECRET,
    baseURL: AUTH_SYSTEM_BASE_URL,
    trustedOrigins: AUTH_SYSTEM_TRUSTED_ORIGINS,
    providers: {
      ...(args.enableGoogle ? { google: AUTH_SYSTEM_GOOGLE_CLIENT } : {}),
      ...(args.enableDev ? { dev: { enabled: true as const } } : {}),
    },
  });
  const server = createAuthServerAdapter({
    getSql: () => sql,
    clock: ports.clock,
    createId: ports.createId,
    secret: AUTH_SYSTEM_SECRET,
  });
  return {
    fabric,
    sql,
    server,
    google,
    fetch: async (path, init) =>
      app.request(`${AUTH_SYSTEM_BASE_URL}${path}`, init),
  };
}

export async function startStore(
  session: Session,
  opts: {
    readonly fabric: AuthFabric;
    readonly enableDev: boolean;
    readonly enableGoogle: boolean;
  }
): Promise<AuthStore> {
  const seed =
    Math.floor(session.ports.rng.fork('sql').next() * 0xffffffff) || 1;
  const sql = openSql(opts.fabric, seed);
  await migrateAuthSchema(opts.fabric, sql);
  return buildStore({
    fabric: opts.fabric,
    sql,
    ports: session.ports,
    enableDev: opts.enableDev,
    enableGoogle: opts.enableGoogle,
  });
}

export function startActor(): ActorState {
  return {
    bearer: null,
    pendingAuthUrl: null,
    pendingCode: null,
  };
}
