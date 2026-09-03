import type { Ports, Session } from '@pkgs/dst';
import { createNoopLogger } from '@pkgs/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplPostgresMem } from '@pkgs/sql-client/postgres/impl-postgres-mem';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres/schema';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client/sqlite/impl-sqlite-mem';

import {
  AuthPostgresDatabaseMigration,
  AuthSqliteDatabaseMigration,
} from '../../server/auth-database-migration';
import { createAuthApp } from '../../server/create-auth-app';
import { createAuthServerAdapter } from '../../server/create-auth-server-adapter';
import { createFakeGoogleHttp } from '../../testing/fake-google';
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

function buildStore(args: {
  readonly fabric: AuthFabric;
  readonly sql: SqlClient;
  readonly ports: Ports;
  readonly enableDev: boolean;
  readonly enableGoogle: boolean;
}): AuthStore {
  const { fabric, sql, ports } = args;
  const sim = { googleFault: false, googleSubjects: new Map<string, string>() };
  const app = createAuthApp({
    getSql: () => sql,
    clock: ports.clock,
    createId: ports.createId,
    http: createFakeGoogleHttp(sim),
    secret: AUTH_SYSTEM_SECRET,
    baseURL: AUTH_SYSTEM_BASE_URL,
    trustedOrigins: AUTH_SYSTEM_TRUSTED_ORIGINS,
    providers: {
      ...(args.enableGoogle
        ? { google: { clientId: 'cid', clientSecret: 'csecret' } }
        : {}),
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
    sim,
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
