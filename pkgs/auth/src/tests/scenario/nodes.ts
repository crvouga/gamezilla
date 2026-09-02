import { knob, node } from '@pkgs/dst';
import { createNoopLogger } from '@pkgs/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplPostgresMem } from '@pkgs/sql-client/postgres/impl-postgres-mem';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres/schema';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client/sqlite/impl-sqlite-mem';
import fc from 'fast-check';

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

export const AUTH_FABRIC = knob(
  'sqlite-mem' satisfies AuthFabric,
  fc.constantFrom<AuthFabric>('sqlite-mem', 'postgres-mem')
);
export const AUTH_DEV_PROVIDER = knob(true, fc.boolean());
export const AUTH_GOOGLE_PROVIDER = knob(true, fc.boolean());
export const AUTH_CLIENT_COUNT = knob(2, fc.integer({ min: 1, max: 3 }));

function openSql(fabric: AuthFabric, seed: bigint): SqlClient {
  const seedNum = Number(seed & 0xffffffffn) || 1;
  return fabric === 'sqlite-mem'
    ? SqlClientImplSqliteMem.open({ seed: seedNum })
    : SqlClientImplPostgresMem.open({ seed: seedNum });
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
  readonly deps: import('@pkgs/dst').WorldPorts;
  readonly enableDev: boolean;
  readonly enableGoogle: boolean;
}): AuthStore {
  const { fabric, sql, deps } = args;
  const sim = { googleFault: false, googleSubjects: new Map<string, string>() };
  const app = createAuthApp({
    getSql: () => sql,
    clock: deps.clock,
    createId: deps.createId,
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
    clock: deps.clock,
    createId: deps.createId,
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

/** SQL fabric + IdP Hono app + fake Google, one per system. */
export const authStoreNode = node({
  start: async (ctx) => {
    const fabric = ctx.knob(AUTH_FABRIC);
    const sql = openSql(fabric, ctx.ports.seed);
    await migrateAuthSchema(fabric, sql);
    return buildStore({
      fabric,
      sql,
      deps: ctx.ports,
      enableDev: ctx.knob(AUTH_DEV_PROVIDER),
      enableGoogle: ctx.knob(AUTH_GOOGLE_PROVIDER),
    });
  },
  stop: async (store) => {
    await store.sql.disconnect();
  },
});

/** Client-side session bag. Zero endpoints — actors drive the store by fetch. */
export const authActorNode = node({
  start: () => {
    const state: ActorState = {
      bearer: null,
      pendingAuthUrl: null,
      pendingCode: null,
    };
    return state;
  },
});
