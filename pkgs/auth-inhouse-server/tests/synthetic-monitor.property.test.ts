import { describe, expect, test } from 'bun:test';
import { createAuthApp } from '@pkgs/auth-inhouse-server/create-auth-app';
import { reconcileIdpSqlite } from '@pkgs/auth-inhouse-server/reconcile-idp-sqlite';
import { isSyntheticMonitor } from '@pkgs/auth-inhouse-server/synthetic-monitor';
import {
  requestSyntheticMonitorRedirect,
  SYNTHETIC_MONITOR_CODE_PATH,
} from '@pkgs/auth-inhouse-shared/synthetic-monitor';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import type { HttpClient } from '@pkgs/http-client-shared/types';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared/impl-mockingbird-sqlite';
import sql from '@pkgs/sql-root-shared/sql';
import fc from 'fast-check';
import { Hono } from 'hono';

const API = 'https://api.gamezilla.app';
const WEB = 'https://www.gamezilla.app';
const PREFIX = '/api';
const SECRET = 'auth-system-secret-0123456789abcdef';
const TOKEN = 'synthetic-monitor-token-0123456789abcdef';
const CALLBACK = `${WEB}/sso-callback`;
/**
 * The round-trip property boots a fresh migrated SQLite IdP per run (40
 * runs, ~0.4 s idle in total); a loaded `bun check-pr` runner needs headroom.
 */
const ROUND_TRIP_TIMEOUT_MS = 30_000;
/** 2026-01-01T00:00:00Z */
const START_MS = 1_767_225_600_000;

type Booted = {
  readonly http: HttpClient;
  readonly sql: SqlClientImplMockingbirdSqlite;
};

async function boot(token: string | null): Promise<Booted> {
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

function postCode(
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

async function exchange(booted: Booted, redirectUrl: string) {
  const code = new URL(redirectUrl).searchParams.get('code') ?? '';
  return booted.http.fetch(`${API}${PREFIX}/auth/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  });
}

async function monitorUserRows(booted: Booted): Promise<number> {
  const rows = await booted.sql.query(sql<{ n: number }>`
    SELECT COUNT(*) AS n FROM idp_users WHERE id LIKE ${'synthetic-monitor:%'}
  `);
  return Number(rows[0]?.n ?? 0);
}

describe('synthetic-monitor sign-in', () => {
  // Decided wire shape: an unconfigured deployment hides the route entirely.
  test('answers 404 when no token is configured', async () => {
    const booted = await boot(null);
    expect((await postCode(booted, TOKEN, CALLBACK)).status).toBe(404);
  });

  test('any bearer other than the configured token is refused', async () => {
    const booted = await boot(TOKEN);
    expect((await postCode(booted, null, CALLBACK)).status).toBe(401);
    await assertProperty(
      'synthetic-monitor rejects foreign tokens',
      fc.asyncProperty(
        fc
          .string({ minLength: 1, maxLength: 80 })
          .filter((s) => s.trim().length > 0 && s.trim() !== TOKEN),
        async (presented) => {
          const res = await postCode(booted, presented, CALLBACK);
          expect(res.status).toBe(401);
          expect(JSON.stringify(await res.json())).not.toContain('code=');
        }
      )
    );
  });

  test('untrusted callback origins never receive a code', async () => {
    const booted = await boot(TOKEN);
    await assertProperty(
      'synthetic-monitor callback must be trusted',
      fc.asyncProperty(
        fc
          .domain()
          .filter(
            (d) => !['api.gamezilla.app', 'www.gamezilla.app'].includes(d)
          ),
        async (host) => {
          const res = await postCode(
            booted,
            TOKEN,
            `https://${host}/sso-callback`
          );
          expect(res.status).toBe(400);
        }
      )
    );
  });

  test(
    'every sign-in yields a single-use code for a fresh monitor user',
    async () => {
      await assertProperty(
        'synthetic-monitor round trip',
        fc.asyncProperty(fc.integer({ min: 1, max: 3 }), async (signIns) => {
          const booted = await boot(TOKEN);
          const users = new Set<string>();
          for (let i = 0; i < signIns; i += 1) {
            const redirectUrl = await requestSyntheticMonitorRedirect({
              http: booted.http,
              apiOrigin: API,
              apiPathPrefix: PREFIX,
              token: TOKEN,
              callbackUrl: CALLBACK,
            });
            expect(redirectUrl.startsWith(`${CALLBACK}?code=`)).toBe(true);
            const first = await exchange(booted, redirectUrl);
            expect(first.status).toBe(200);
            const session = (await first.json()) as {
              readonly user: { readonly id: string };
            };
            expect(isSyntheticMonitor(session.user.id)).toBe(true);
            users.add(session.user.id);
            expect((await exchange(booted, redirectUrl)).status).toBe(400);
          }
          expect(users.size).toBe(signIns);
          expect(await monitorUserRows(booted)).toBe(signIns);
        })
      );
    },
    ROUND_TRIP_TIMEOUT_MS
  );
});

test('independent monitor participants cannot select an arbitrary person', async () => {
  const booted = await boot(TOKEN);
  for (const peer of [false, true]) {
    const redirect = await requestSyntheticMonitorRedirect({
      http: booted.http,
      apiOrigin: API,
      apiPathPrefix: PREFIX,
      token: TOKEN,
      callbackUrl: CALLBACK,
      peer,
    });
    const response = await exchange(booted, redirect);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { user: { id: string } };
    expect(body.user.id).not.toBe('someone-else');
    expect(isSyntheticMonitor(body.user.id)).toBe(true);
  }
  expect(isSyntheticMonitor('someone-else')).toBe(false);
  const response = await booted.http.fetch(
    `${API}${PREFIX}${SYNTHETIC_MONITOR_CODE_PATH}`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        callbackUrl: CALLBACK,
        userId: 'someone-else',
        peer: 'someone-else',
      }),
    }
  );
  const redirect = (await response.json()) as { redirectUrl: string };
  const session = (await (
    await exchange(booted, redirect.redirectUrl)
  ).json()) as { user: { id: string } };
  expect(isSyntheticMonitor(session.user.id)).toBe(true);
  expect(session.user.id).not.toBe('someone-else');
});

// regression: synthetic-monitor-ratings-leak-between-journeys
test('consecutive multiplayer journeys get disjoint pairs of monitoring accounts', async () => {
  const booted = await boot(TOKEN);
  const ids = new Set<string>();
  for (const peer of [false, true, false, true]) {
    const redirect = await requestSyntheticMonitorRedirect({
      http: booted.http,
      apiOrigin: API,
      apiPathPrefix: PREFIX,
      token: TOKEN,
      callbackUrl: CALLBACK,
      peer,
    });
    const response = await exchange(booted, redirect);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { user: { id: string } };
    expect(isSyntheticMonitor(body.user.id)).toBe(true);
    ids.add(body.user.id);
  }
  expect(ids.size).toBe(4);
  expect(await monitorUserRows(booted)).toBe(4);
});
