import { defineNodeKind, type SimDeps } from '@pkgs/determinism';
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
import { createFakeGoogleHttp } from './fake-google';
import {
  type ActorState,
  AUTH_SYSTEM_BASE_URL,
  AUTH_SYSTEM_SECRET,
  AUTH_SYSTEM_TRUSTED_ORIGINS,
  type AuthFabric,
  type AuthStore,
  type AuthSystem,
} from './types';

export const AUTH_STORE_KIND = 'auth.store';
export const AUTH_ACTOR_KIND = 'auth.actor';

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

type StoreArgs = {
  readonly fabric: AuthFabric;
  readonly sql: SqlClient;
  readonly deps: SimDeps;
  readonly system: AuthSystem;
  readonly enableDev: boolean;
  readonly enableGoogle: boolean;
};

function buildStore(args: StoreArgs): AuthStore {
  const { fabric, sql, deps, system } = args;
  const app = createAuthApp({
    getSql: () => sql,
    clock: deps.clock,
    createId: deps.createId,
    http: createFakeGoogleHttp(system),
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
    fetch: async (path, init) =>
      app.request(`${AUTH_SYSTEM_BASE_URL}${path}`, init),
  };
}

/** SQL fabric + IdP Hono app + fake Google, one per system. */
export const authStoreNode = defineNodeKind<AuthStore, AuthStore, AuthSystem>({
  id: AUTH_STORE_KIND,
  boot: async (ctx) => {
    const fabric = ctx.knobs.get('fabric') as AuthFabric;
    const sql = openSql(fabric, ctx.deps.seed);
    await migrateAuthSchema(fabric, sql);
    const store = buildStore({
      fabric,
      sql,
      deps: ctx.deps,
      system: ctx.system,
      enableDev: ctx.knobs.get('devProvider') !== false,
      enableGoogle: ctx.knobs.get('googleProvider') !== false,
    });
    ctx.system.store = store;
    return store;
  },
  dispose: async (store) => {
    await store.sql.disconnect();
  },
});

/** Client-side session bag. Zero endpoints — actors drive the store by fetch. */
export const authActorNode = defineNodeKind<ActorState, ActorState, AuthSystem>(
  {
    id: AUTH_ACTOR_KIND,
    boot: (ctx) => {
      const state: ActorState = {
        bearer: null,
        pendingAuthUrl: null,
        pendingCode: null,
      };
      ctx.system.actors.set(ctx.nodeId, state);
      return state;
    },
  }
);
