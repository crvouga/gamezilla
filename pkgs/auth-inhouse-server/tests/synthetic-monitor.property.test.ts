import { describe, expect, test } from 'bun:test';
import { createAuthApp } from '@pkgs/auth-inhouse-server/create-auth-app';
import { reconcileIdpSqlite } from '@pkgs/auth-inhouse-server/reconcile-idp-sqlite';
import { SYNTHETIC_MONITOR_USER } from '@pkgs/auth-inhouse-server/synthetic-monitor';
import { requestSyntheticMonitorRedirect, SYNTHETIC_MONITOR_CODE_PATH } from '@pkgs/auth-inhouse-shared/synthetic-monitor';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import type { HttpClient } from '@pkgs/http-client-shared/types';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';
import sql from '@pkgs/sql-shared/sql';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-shared/impl-mockingbird-sqlite';
import { Hono } from 'hono';

const API = 'https://api.gamezilla.app';
const WEB = 'https://www.gamezilla.app';
const PREFIX = '/api';
const SECRET = 'auth-system-secret-0123456789abcdef';
const TOKEN = 'synthetic-monitor-token-0123456789abcdef';
const CALLBACK = `${WEB}/sso-callback`;
/**
 * The round-trip property boots a fresh migrated SQLite IdP per run (40
 * runs, ~0.4 s idle in total); a loaded `bun check` runner needs headroom.
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
    SELECT COUNT(*) AS n FROM idp_users WHERE id = ${SYNTHETIC_MONITOR_USER.id}
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
    'every sign-in yields a single-use code for the one monitor user',
    async () => {
      await assertProperty(
        'synthetic-monitor round trip',
        fc.asyncProperty(fc.integer({ min: 1, max: 3 }), async (signIns) => {
          const booted = await boot(TOKEN);
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
            expect(session.user.id).toBe(SYNTHETIC_MONITOR_USER.id);
            expect((await exchange(booted, redirectUrl)).status).toBe(400);
          }
          expect(await monitorUserRows(booted)).toBe(1);
        })
      );
    },
    ROUND_TRIP_TIMEOUT_MS
  );
});
