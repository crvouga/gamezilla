import type { HttpClient } from '@pkgs/http-client';
import { createNoopLogger } from '@pkgs/logger';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplPostgresMem } from '@pkgs/sql-client/postgres/impl-postgres-mem';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres/schema';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client/sqlite/impl-sqlite-mem';
import { createSimAdapters } from '@pkgs/uuid';

import {
  AuthPostgresDatabaseMigration,
  AuthSqliteDatabaseMigration,
} from '../../server/auth-database-migration';
import { createAuthApp } from '../../server/create-auth-app';
import { createAuthServerAdapter } from '../../server/create-auth-server-adapter';
import { GOOGLE_OAUTH_TOKEN_URL } from '../../shared/auth-constants';

export type AuthFabric = 'sqlite-mem' | 'postgres-mem';

type ClientState = {
  bearer: string | null;
  pendingAuthUrl: string | null;
  pendingCode: string | null;
};

export type AuthWorld = {
  readonly fabric: AuthFabric;
  readonly sql: SqlClient;
  readonly clock: ReturnType<typeof createSimAdapters>['clock'];
  readonly createId: ReturnType<typeof createSimAdapters>['createId'];
  readonly app: ReturnType<typeof createAuthApp>;
  readonly server: ReturnType<typeof createAuthServerAdapter>;
  readonly clients: Map<string, ClientState>;
  readonly googleSubjects: Map<string, string>;
  googleFault: boolean;
};

const SECRET = 'auth-dst-secret-0123456789abcdef';
export const AUTH_DST_BASE_URL = 'http://auth.test';
const TRUSTED = [
  AUTH_DST_BASE_URL,
  'gamezilla://',
  'http://localhost:5173',
  'http://callback.test',
];

async function migrate(
  fabric: AuthFabric,
  sqlClient: SqlClient
): Promise<void> {
  const logger = createNoopLogger();
  if (fabric === 'sqlite-mem') {
    await new AuthSqliteDatabaseMigration().migrate({
      sqlClient,
      logger,
    });
    return;
  }
  await new AuthPostgresDatabaseMigration({
    dbScope: createPostgresDbScope('public'),
    skipAdvisoryLock: true,
    alreadyInTransaction: false,
  }).migrate({ sqlClient, logger });
}

function createFakeGoogleHttp(world: {
  googleFault: boolean;
  googleSubjects: Map<string, string>;
}): HttpClient {
  return {
    async fetch(input, init) {
      const url = String(input);
      if (world.googleFault) {
        throw new Error('google http fault');
      }
      if (url === GOOGLE_OAUTH_TOKEN_URL) {
        const body = typeof init?.body === 'string' ? init.body : '';
        const params = new URLSearchParams(body);
        const code = params.get('code') ?? '';
        return new Response(
          JSON.stringify({
            access_token: `access-${code}`,
            refresh_token: `refresh-${code}`,
            token_type: 'Bearer',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      if (url.includes('userinfo')) {
        const headers = init?.headers;
        let access = '';
        if (headers instanceof Headers) {
          access = headers.get('authorization') ?? '';
        } else if (headers !== undefined && typeof headers === 'object') {
          const rec = headers as Record<string, string>;
          access = rec['authorization'] ?? rec['Authorization'] ?? '';
        }
        const code = access.replace(/^Bearer\s+access-/i, '');
        const sub = world.googleSubjects.get(code) ?? `sub-${code}`;
        return new Response(
          JSON.stringify({
            sub,
            email: `${sub}@gmail.test`,
            name: sub,
            picture: null,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      return new Response('not found', { status: 404 });
    },
  };
}

export async function openAuthWorld(args: {
  readonly seed: number | string;
  readonly fabric: AuthFabric;
  readonly clientIds?: readonly string[];
  readonly enableDev?: boolean;
  readonly enableGoogle?: boolean;
}): Promise<AuthWorld> {
  const adapters = createSimAdapters({
    seed: args.seed,
    startMs: 1_700_000_000_000,
  });
  const sqlClient =
    args.fabric === 'sqlite-mem'
      ? SqlClientImplSqliteMem.open({ seed: Number(args.seed) || 1 })
      : SqlClientImplPostgresMem.open({ seed: Number(args.seed) || 1 });
  await migrate(args.fabric, sqlClient);

  const googleSubjects = new Map<string, string>();
  const faultBox = { googleFault: false };
  const http = createFakeGoogleHttp({
    get googleFault() {
      return faultBox.googleFault;
    },
    googleSubjects,
  });

  const app = createAuthApp({
    getSql: () => sqlClient,
    clock: adapters.clock,
    createId: adapters.createId,
    http,
    secret: SECRET,
    baseURL: AUTH_DST_BASE_URL,
    trustedOrigins: TRUSTED,
    providers: {
      ...(args.enableGoogle !== false
        ? { google: { clientId: 'cid', clientSecret: 'csecret' } }
        : {}),
      ...(args.enableDev !== false ? { dev: { enabled: true as const } } : {}),
    },
  });

  const server = createAuthServerAdapter({
    getSql: () => sqlClient,
    clock: adapters.clock,
    createId: adapters.createId,
    secret: SECRET,
  });

  const clients = new Map<string, ClientState>();
  for (const id of args.clientIds ?? ['c0', 'c1']) {
    clients.set(id, {
      bearer: null,
      pendingAuthUrl: null,
      pendingCode: null,
    });
  }

  return {
    fabric: args.fabric,
    sql: sqlClient,
    clock: adapters.clock,
    createId: adapters.createId,
    app,
    server,
    clients,
    googleSubjects,
    get googleFault() {
      return faultBox.googleFault;
    },
    set googleFault(v: boolean) {
      faultBox.googleFault = v;
    },
  };
}

export async function appFetch(
  world: AuthWorld,
  path: string,
  init?: RequestInit
): Promise<Response> {
  return world.app.request(`${AUTH_DST_BASE_URL}${path}`, init);
}

export type AuthCmd =
  | {
      readonly kind: 'devComplete';
      readonly clientId: string;
      readonly subject: string;
    }
  | {
      readonly kind: 'googleStart';
      readonly clientId: string;
      readonly callbackUrl: string;
    }
  | {
      readonly kind: 'googleApprove';
      readonly clientId: string;
      readonly subject: string;
    }
  | { readonly kind: 'sessionExchange'; readonly clientId: string }
  | { readonly kind: 'signOut'; readonly clientId: string }
  | { readonly kind: 'advanceClock'; readonly ms: number }
  | {
      readonly kind: 'stealBearer';
      readonly from: string;
      readonly to: string;
    }
  | { readonly kind: 'setGoogleFault'; readonly fault: boolean };

import { applyAuthCmd } from './apply-auth-cmd';

export { applyAuthCmd };

export async function assertAuthInvariants(world: AuthWorld): Promise<void> {
  for (const [, client] of world.clients) {
    if (client.bearer === null) continue;
    const verified = await world.server.verifySessionToken(client.bearer);
    if (verified === null) continue;
    if (verified.externalUserId.length === 0) {
      throw new Error('verified session missing externalUserId');
    }
  }
}

export async function worldFingerprint(world: AuthWorld): Promise<string> {
  const users = await world.sql.query(
    sql<{
      id: string;
      email: string | null;
      name: string | null;
    }>`SELECT id, email, name FROM idp_users ORDER BY id`
  );
  const accounts = await world.sql.query(sql<{
    provider: string;
    provider_user_id: string;
    user_id: string;
  }>`
    SELECT provider, provider_user_id, user_id
    FROM idp_accounts
    ORDER BY provider, provider_user_id
  `);
  const sessions = await world.sql.query(sql<{
    user_id: string;
    token_hash: string;
  }>`
    SELECT user_id, token_hash FROM idp_sessions ORDER BY token_hash
  `);
  const bearers = [...world.clients.entries()]
    .map(([id, c]) => `${id}:${c.bearer ?? ''}`)
    .sort();
  return JSON.stringify({ users, accounts, sessions, bearers });
}

export async function runAuthCommands(
  world: AuthWorld,
  cmds: readonly AuthCmd[]
): Promise<void> {
  for (const cmd of cmds) {
    await applyAuthCmd(world, cmd);
    await assertAuthInvariants(world);
  }
}
