import { expect, test } from 'bun:test';
import { AUTH_OAUTH_STATE_TTL_MS } from '@pkgs/auth-inhouse-shared-ts/auth-constants';
import { SYNTHETIC_MONITOR_CODE_PATH } from '@pkgs/auth-inhouse-shared-ts/synthetic-monitor';
import {
  API,
  boot,
  CALLBACK,
  exchange,
  monitorUserRows,
  PREFIX,
  TOKEN,
} from './synthetic-monitor-fixture';

type MonitorSignIn = { redirectUrl: string; continuationToken: string };

async function request(
  booted: Awaited<ReturnType<typeof boot>>,
  body: { callbackUrl: string; continuationToken?: string },
  bearer = TOKEN
): Promise<Response> {
  return booted.http.fetch(`${API}${PREFIX}${SYNTHETIC_MONITOR_CODE_PATH}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${bearer}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function signedInId(
  booted: Awaited<ReturnType<typeof boot>>,
  redirect: string
): Promise<string> {
  const response = await exchange(booted, redirect);
  expect(response.status).toBe(200);
  const body = (await response.json()) as { user: { id: string } };
  return body.user.id;
}

// regression: live-journey-second-device-changes-account
test('another device continues the same monitor account while the next journey starts fresh', async () => {
  const booted = await boot(TOKEN);
  const first = (await (
    await request(booted, { callbackUrl: CALLBACK })
  ).json()) as MonitorSignIn;
  expect(typeof first.continuationToken).toBe('string');
  const original = await signedInId(booted, first.redirectUrl);
  const second = (await (
    await request(booted, {
      callbackUrl: CALLBACK,
      continuationToken: first.continuationToken,
    })
  ).json()) as MonitorSignIn;
  expect(await signedInId(booted, second.redirectUrl)).toBe(original);
  expect((await exchange(booted, second.redirectUrl)).status).toBe(400);
  expect(await monitorUserRows(booted)).toBe(1);
  const fresh = (await (
    await request(booted, { callbackUrl: CALLBACK })
  ).json()) as MonitorSignIn;
  expect(await signedInId(booted, fresh.redirectUrl)).not.toBe(original);
  expect(await monitorUserRows(booted)).toBe(2);
});

test('invalid or expired monitor continuation never silently creates another account', async () => {
  const booted = await boot(TOKEN);
  const first = (await (
    await request(booted, { callbackUrl: CALLBACK })
  ).json()) as MonitorSignIn;
  for (const continuationToken of [
    '',
    'someone-else',
    `${first.continuationToken}x`,
  ])
    expect(
      (await request(booted, { callbackUrl: CALLBACK, continuationToken }))
        .status
    ).toBe(400);
  booted.clock.advance(AUTH_OAUTH_STATE_TTL_MS - 1);
  expect(
    (
      await request(booted, {
        callbackUrl: CALLBACK,
        continuationToken: first.continuationToken,
      })
    ).status
  ).toBe(200);
  booted.clock.advance(1);
  expect(
    (
      await request(booted, {
        callbackUrl: CALLBACK,
        continuationToken: first.continuationToken,
      })
    ).status
  ).toBe(400);
  expect(await monitorUserRows(booted)).toBe(1);
});

test('a monitor continuation is bound to the trusted callback it was issued for', async () => {
  const booted = await boot(TOKEN);
  const first = (await (
    await request(booted, { callbackUrl: CALLBACK })
  ).json()) as MonitorSignIn;
  expect(
    (
      await request(booted, {
        callbackUrl: `${API}/sso-callback`,
        continuationToken: first.continuationToken,
      })
    ).status
  ).toBe(400);
  expect(await monitorUserRows(booted)).toBe(1);
});

test('rotating the monitoring secret invalidates a prior device continuation', async () => {
  const original = await boot(TOKEN);
  const first = (await (
    await request(original, { callbackUrl: CALLBACK })
  ).json()) as MonitorSignIn;
  const rotatedToken = `${TOKEN}-rotated`;
  const rotated = await boot(rotatedToken);
  expect(
    (await request(rotated, { callbackUrl: CALLBACK }, rotatedToken)).status
  ).toBe(200);
  expect(
    (
      await request(
        rotated,
        { callbackUrl: CALLBACK, continuationToken: first.continuationToken },
        rotatedToken
      )
    ).status
  ).toBe(400);
  expect(await monitorUserRows(rotated)).toBe(1);
});
