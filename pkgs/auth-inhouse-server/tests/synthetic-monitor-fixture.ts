import { createAuthApp } from '@pkgs/auth-inhouse-server/create-auth-app';
import { reconcileIdpSqlite } from '@pkgs/auth-inhouse-server/reconcile-idp-sqlite';
import { SYNTHETIC_MONITOR_CODE_PATH } from '@pkgs/auth-inhouse-shared/synthetic-monitor';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import type { HttpClient } from '@pkgs/http-client-shared/types';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared/impl-mockingbird-sqlite';
import sql from '@pkgs/sql-root-shared/sql';
import { Hono } from 'hono';

export const API = 'https://api.gamezilla.app';
export const WEB = 'https://www.gamezilla.app';
export const PREFIX = '/api';
const SECRET = 'auth-system-secret-0123456789abcdef';
export const TOKEN = 'synthetic-monitor-token-0123456789abcdef';
export const CALLBACK = `${WEB}/sso-callback`;
/** 2026-01-01T00:00:00Z */
const START_MS = 1_767_225_600_000;

type Booted = {
  readonly http: HttpClient;
  readonly sql: SqlClientImplMockingbirdSqlite;
};

export async function boot(token: string | null): Promise<Booted> {
  const sql = SqlClientImplMockingbirdSqlite.open({ seed: 1 });
  await reconcileIdpSqlite(sql);
  let nextId = 0;
  const { clock } = createHarnessClock({ startMs: START_MS });
  const authApp = createAuthApp({
    getSql: () => sql,
    clock,
    createId: () => `id-${(nextId += 1)}`,
    http: { fetch: () => Promise.reject(new Error('no egress in this test')) },
    secret: SECRET,
    baseURL: API,
    publicPathPrefix: PREFIX,
    trustedOrigins: [API, WEB],
    providers: {},
    ...(token === null ? {} : { syntheticMonitor: { token } }),
  });
  const app = new Hono().route(PREFIX, authApp);
  return {
    sql,
    http: { fetch: async (input, init) => app.request(input as string, init) },
  };
}

export function postCode(
  booted: Booted,
  bearer: string | null,
  callbackUrl: string
): Promise<Response> {
  return booted.http.fetch(`${API}${PREFIX}${SYNTHETIC_MONITOR_CODE_PATH}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(bearer === null ? {} : { authorization: `Bearer ${bearer}` }),
    },
    body: JSON.stringify({ callbackUrl }),
  });
}

export async function exchange(booted: Booted, redirectUrl: string) {
  const code = new URL(redirectUrl).searchParams.get('code') ?? '';
  return booted.http.fetch(`${API}${PREFIX}/auth/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  });
}

export async function monitorUserRows(booted: Booted): Promise<number> {
  const rows = await booted.sql.query(sql<{ n: number }>`
    SELECT COUNT(*) AS n FROM idp_users WHERE id LIKE ${'synthetic-monitor:%'}
  `);
  return Number(rows[0]?.n ?? 0);
}
