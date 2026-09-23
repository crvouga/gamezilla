import { expect } from 'bun:test';
import { generateKeyPairSync, type JsonWebKey, sign } from 'node:crypto';
import { apiNow, appleResponse } from '@apps/product/sim/acceptance/system';

import {
  type Actor,
  type ApiRun,
  CALLBACK,
  call,
  deviceId,
  headers,
  type Json,
  text,
} from './support';

// Ephemeral signing key for this process. Never a real Apple credential.
const signingKey = generateKeyPairSync('rsa', { modulusLength: 2048 });
const exported = signingKey.publicKey.export({ format: 'jwk' }) as JsonWebKey;
const jwk = {
  kty: exported.kty,
  n: exported.n,
  e: exported.e,
  kid: 'acceptance',
  alg: 'RS256',
  use: 'sig',
};
const b64 = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

export async function appleCallback(
  s: ApiRun,
  identity: { sub: string; email?: string; privateEmail?: boolean },
  options: { linkTo?: Actor; claims?: Json; tamper?: boolean } = {}
) {
  const launch = await call(s, {
    path: `/auth/oauth/launch?provider=apple&callbackUrl=${encodeURIComponent(CALLBACK)}${options.linkTo ? '&intent=link' : ''}`,
    method: 'GET',
    ...(options.linkTo ? { headers: headers(options.linkTo) } : {}),
  });
  expect(launch.status).toBe(302);
  const url = new URL(launch.headers['location']!);
  expect(url.origin).toBe('https://appleid.apple.com');
  expect(url.searchParams.get('response_mode')).toBe('form_post');
  const state = url.searchParams.get('state');
  const nonce = url.searchParams.get('nonce');
  expect(state).toBeTruthy();
  expect(nonce).toBeTruthy();
  const now = Math.floor((await s.read(apiNow)) / 1000);
  const payload = {
    iss: 'https://appleid.apple.com',
    aud: 'acceptance-apple',
    sub: identity.sub,
    iat: now,
    exp: now + 300,
    nonce,
    email: identity.email,
    email_verified: 'true',
    is_private_email: String(identity.privateEmail ?? false),
    ...options.claims,
  };
  const signingInput = `${b64({ alg: 'RS256', kid: 'acceptance' })}.${b64(payload)}`;
  const signature = sign(
    'RSA-SHA256',
    Buffer.from(signingInput),
    signingKey.privateKey
  ).toString('base64url');
  const token = `${signingInput}.${options.tamper ? 'invalid' : signature}`;
  await s.apply(appleResponse, token, jwk);
  return call(s, {
    path: '/auth/callback/apple',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    rawBody: new URLSearchParams({
      state: state!,
      code: 'apple-code',
      id_token: token,
    }).toString(),
  });
}

export async function appleLogin(
  s: ApiRun,
  n: number,
  identity: { sub: string; email?: string; privateEmail?: boolean },
  linkTo?: Actor
): Promise<Actor> {
  const callback = await appleCallback(s, identity, linkTo ? { linkTo } : {});
  expect(callback.status).toBe(302);
  const code = new URL(callback.headers['location']!).searchParams.get('code');
  const session = await call(s, { path: '/auth/session', body: { code } });
  expect(session.status).toBe(200);
  const actor: Actor = {
    token: text((session.body as Json)['token'], 'session token'),
    deviceId: deviceId(n),
    accountId: '',
    seq: 0,
  };
  const refresh = await call(s, {
    path: '/identity/refresh',
    headers: headers(actor),
    body: {},
  });
  expect(refresh.status).toBe(200);
  actor.accountId = text((refresh.body as Json)['accountId'], 'account id');
  return actor;
}
