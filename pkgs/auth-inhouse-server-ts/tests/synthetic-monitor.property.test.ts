import { describe, expect, test } from 'bun:test';
import { isSyntheticMonitor } from '@pkgs/auth-inhouse-server-ts/synthetic-monitor';
import {
  requestSyntheticMonitorRedirect,
  SYNTHETIC_MONITOR_CODE_PATH,
} from '@pkgs/auth-inhouse-shared-ts/synthetic-monitor';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import {
  API,
  boot,
  CALLBACK,
  exchange,
  monitorUserRows,
  PREFIX,
  postCode,
  TOKEN,
} from './synthetic-monitor-fixture';

/** Migrated IdP per draw; retain headroom under the full gate's load. */
const ROUND_TRIP_TIMEOUT_MS = 30_000;

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
            (d) =>
              ![new URL(API).hostname, new URL(CALLBACK).hostname].includes(d)
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
