/**
 * Sign in with Apple, relying-party side.
 *
 * Apple has no userinfo endpoint: the person is whoever the id_token says,
 * so the id_token is verified properly — signature against Apple's JWKS,
 * `iss`, `aud`, expiry with a small skew allowance, and the `nonce` this app
 * sent. The client authenticates with an ES256 JWT it signs itself. The name
 * arrives exactly once, as a JSON form field on the first authorization; the
 * address may be a private relay. Boolean claims may be `"true"` strings.
 */

import type { AppleOauthEndpoints } from '@pkgs/auth-inhouse-shared-ts/auth-constants';
import {
  APPLE_CLIENT_SECRET_AUDIENCE,
  IDP_PROVIDER_APPLE,
} from '@pkgs/auth-inhouse-shared-ts/auth-constants';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import { importJWK, type JWK, SignJWT } from 'jose';
import type { JwksVerifier } from './jwks-verifier';
import { createJwksVerifier } from './jwks-verifier';
import type {
  OauthProviderAdapter,
  ProviderCallback,
  ProviderIdentity,
} from './provider-identity';
import { claimFlag, claimString } from './provider-identity';

export type AppleProviderConfig = {
  /** The Services ID. */
  readonly clientId: string;
  readonly teamId: string;
  readonly keyId: string;
  /** The Sign in with Apple private key (ES256), as a JWK. */
  readonly privateJwk: JWK;
  readonly endpoints: AppleOauthEndpoints;
  /** `https://appleid.apple.com`, or the mock's origin. */
  readonly issuer: string;
};

/** Client secrets are valid for an hour here; Apple allows up to six months. */
const CLIENT_SECRET_LIFETIME_S = 60 * 60;
/** An id_token issued further in the future than this is refused. */
const MAX_FUTURE_IAT_S = 5 * 60;

export async function appleClientSecret(
  apple: AppleProviderConfig,
  nowMs: number
): Promise<string> {
  const key = await importJWK(apple.privateJwk, 'ES256');
  const iat = Math.floor(nowMs / 1000);
  return await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: apple.keyId })
    .setIssuer(apple.teamId)
    .setSubject(apple.clientId)
    .setAudience(APPLE_CLIENT_SECRET_AUDIENCE)
    .setIssuedAt(iat)
    .setExpirationTime(iat + CLIENT_SECRET_LIFETIME_S)
    .sign(key);
}

export function buildAppleAuthorizationUrl(args: {
  readonly apple: AppleProviderConfig;
  readonly redirectUri: string;
  readonly state: string;
  readonly nonce: string;
}): string {
  const url = new URL(args.apple.endpoints.authorizeUrl);
  url.searchParams.set('client_id', args.apple.clientId);
  url.searchParams.set('redirect_uri', args.redirectUri);
  url.searchParams.set('response_type', 'code');
  // Asking for name or email obliges Apple to answer with a form post.
  url.searchParams.set('response_mode', 'form_post');
  url.searchParams.set('scope', 'name email');
  url.searchParams.set('state', args.state);
  url.searchParams.set('nonce', args.nonce);
  return url.toString();
}

/** `{"name":{"firstName","lastName"},"email"}` → "First Last". */
export function appleUserName(raw: string | null): string | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return null;
    const name = (parsed as { name?: unknown }).name;
    if (name === null || typeof name !== 'object') return null;
    const parts = [
      claimString((name as Record<string, unknown>)['firstName']),
      claimString((name as Record<string, unknown>)['lastName']),
    ].filter((part): part is string => part !== null);
    return parts.length > 0 ? parts.join(' ') : null;
  } catch {
    return null;
  }
}

async function postForm(
  http: HttpClient,
  url: string,
  fields: Record<string, string>
): Promise<Response> {
  return await http.fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  });
}

function identityFromClaims(
  claims: Record<string, unknown>,
  tokens: { accessToken: string | null; refreshToken: string | null },
  callback: ProviderCallback
): ProviderIdentity {
  const sub = claimString(claims['sub']);
  if (sub === null) throw new Error('apple id_token missing sub');
  const email = claimString(claims['email'])?.toLowerCase() ?? null;
  return {
    provider: IDP_PROVIDER_APPLE,
    providerUserId: sub,
    email,
    emailVerified: email !== null && claimFlag(claims['email_verified']),
    isPrivateEmail: claimFlag(claims['is_private_email']),
    name: appleUserName(callback.user),
    picture: null,
    ...tokens,
  };
}

export async function exchangeAppleAuthorizationCode(args: {
  readonly http: HttpClient;
  readonly clock: Clock;
  readonly apple: AppleProviderConfig;
  readonly verify: JwksVerifier;
  readonly redirectUri: string;
  readonly callback: ProviderCallback;
  readonly nonce: string;
}): Promise<ProviderIdentity> {
  const { apple } = args;
  const res = await postForm(args.http, apple.endpoints.tokenUrl, {
    client_id: apple.clientId,
    client_secret: await appleClientSecret(apple, args.clock.now()),
    code: args.callback.code,
    grant_type: 'authorization_code',
    redirect_uri: args.redirectUri,
  });
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`apple token exchange failed: ${String(res.status)}`);
  }
  const body = (await res.json()) as Record<string, unknown>;
  const idToken = claimString(body['id_token']);
  if (idToken === null)
    throw new Error('apple token response missing id_token');
  const claims = await args.verify(idToken, {
    issuer: apple.issuer,
    audience: apple.clientId,
  });
  if (claims['nonce'] !== args.nonce)
    throw new Error('apple id_token nonce mismatch');
  const iat = typeof claims.iat === 'number' ? claims.iat : 0;
  if (iat * 1000 > args.clock.now() + MAX_FUTURE_IAT_S * 1000) {
    throw new Error('apple id_token issued in the future');
  }
  return identityFromClaims(
    claims,
    {
      accessToken: claimString(body['access_token']),
      refreshToken: claimString(body['refresh_token']),
    },
    args.callback
  );
}

async function revokeAppleToken(
  args: { http: HttpClient; clock: Clock; apple: AppleProviderConfig },
  token: string
): Promise<boolean> {
  try {
    const res = await postForm(args.http, args.apple.endpoints.revokeUrl, {
      client_id: args.apple.clientId,
      client_secret: await appleClientSecret(args.apple, args.clock.now()),
      token,
      token_type_hint: 'refresh_token',
    });
    await res.body?.cancel();
    return res.ok;
  } catch {
    return false;
  }
}

export type AppleProvider = OauthProviderAdapter & {
  /** Verify a server-to-server notification payload (same keys). */
  readonly verify: JwksVerifier;
  readonly config: AppleProviderConfig;
};

export function createAppleProvider(args: {
  readonly apple: AppleProviderConfig;
  readonly http: HttpClient;
  readonly clock: Clock;
}): AppleProvider {
  const verify = createJwksVerifier({
    http: args.http,
    jwksUrl: args.apple.endpoints.jwksUrl,
    clock: args.clock,
  });
  return {
    id: IDP_PROVIDER_APPLE,
    callbackMethod: 'POST',
    config: args.apple,
    verify,
    authorizationUrl: async (auth) =>
      buildAppleAuthorizationUrl({ apple: args.apple, ...auth }),
    exchange: async (exchange) =>
      await exchangeAppleAuthorizationCode({
        ...args,
        verify,
        redirectUri: exchange.redirectUri,
        callback: exchange.callback,
        nonce: exchange.nonce,
      }),
    revoke: async (token) => await revokeAppleToken(args, token),
  };
}
