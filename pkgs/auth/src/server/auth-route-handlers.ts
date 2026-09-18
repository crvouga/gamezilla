import type { Context } from 'hono';

import {
  AUTH_SET_TOKEN_HEADER,
  IDP_PROVIDER_GOOGLE,
} from '../shared/auth-constants';
import { isTrustedCallbackUrl } from '../shared/trusted-origins';
import type { CreateAuthAppDeps } from './create-auth-app-types';
import {
  buildGoogleAuthorizationUrl,
  exchangeGoogleAuthorizationCode,
} from './google-oauth';
import { IdpRepository } from './idp-repository';

type SessionUserJson = {
  readonly id: string;
  readonly email: string | null;
  readonly name: string | null;
  readonly image: string | null;
};

export function sessionJson(
  user: SessionUserJson,
  token: string,
  expiresAtMs: number
): {
  readonly token: string;
  readonly expiresAt: string;
  readonly user: SessionUserJson;
} {
  return {
    token,
    expiresAt: new Date(expiresAtMs).toISOString(),
    user,
  };
}

export function readBearer(header: string | undefined): string | null {
  if (header === undefined) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (match === null) return null;
  const token = match[1]?.trim() ?? '';
  return token.length > 0 ? token : null;
}

export function repo(deps: CreateAuthAppDeps): IdpRepository {
  return new IdpRepository(
    deps.getSql(),
    deps.clock,
    deps.createId,
    deps.secret
  );
}

export function providerCallbackUri(
  baseURL: string,
  publicPathPrefix: string,
  provider: string
): string {
  const origin = baseURL.replace(/\/$/, '');
  const prefix = publicPathPrefix.replace(/\/$/, '');
  return `${origin}${prefix}/auth/callback/${provider}`;
}

export function googleRedirectUri(
  baseURL: string,
  publicPathPrefix: string
): string {
  return providerCallbackUri(baseURL, publicPathPrefix, IDP_PROVIDER_GOOGLE);
}

function readStringField(raw: unknown, key: string): string {
  if (raw === null || typeof raw !== 'object') return '';
  const value = (raw as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}

function publicPrefix(deps: CreateAuthAppDeps): string {
  return deps.publicPathPrefix ?? '';
}

function isSupportedProvider(provider: string): boolean {
  return provider === IDP_PROVIDER_GOOGLE;
}

function providerEnabled(deps: CreateAuthAppDeps, provider: string): boolean {
  return (
    provider === IDP_PROVIDER_GOOGLE && deps.providers.google !== undefined
  );
}

async function finishOauthCallback(args: {
  readonly c: Context;
  readonly deps: CreateAuthAppDeps;
  readonly oauthState: {
    readonly id: string;
    readonly callback_url: string;
  };
  readonly user: SessionUserJson;
}): Promise<Response> {
  const exchangeCode = await repo(args.deps).attachExchangeCode({
    stateId: args.oauthState.id,
    userId: args.user.id,
  });
  const redirect = new URL(args.oauthState.callback_url);
  redirect.searchParams.set('code', exchangeCode);
  return args.c.redirect(redirect.toString(), 302);
}

export async function handleOauthLaunch(
  c: Context,
  deps: CreateAuthAppDeps
): Promise<Response> {
  const provider = c.req.query('provider') ?? '';
  const callbackUrl = c.req.query('callbackUrl') ?? '';
  if (!isSupportedProvider(provider)) {
    return c.json({ error: 'unsupported_provider' }, 400);
  }
  if (!providerEnabled(deps, provider)) {
    return c.json({ error: 'provider_disabled' }, 404);
  }
  if (
    callbackUrl.length === 0 ||
    !isTrustedCallbackUrl(callbackUrl, deps.trustedOrigins)
  ) {
    return c.json({ error: 'invalid_callback_url' }, 400);
  }
  const r = repo(deps);
  const { state, codeVerifier } = await r.createOauthState({
    provider,
    callbackUrl,
  });
  const google = deps.providers.google;
  if (google === undefined) {
    return c.json({ error: 'provider_disabled' }, 404);
  }
  const authorizationUrl = buildGoogleAuthorizationUrl({
    google,
    redirectUri: googleRedirectUri(deps.baseURL, publicPrefix(deps)),
    state,
    codeVerifier,
  });
  return c.redirect(authorizationUrl, 302);
}

export async function handleOauthCallback(
  c: Context,
  deps: CreateAuthAppDeps
): Promise<Response> {
  const provider = c.req.param('provider') ?? '';
  if (!isSupportedProvider(provider)) {
    return c.json({ error: 'unsupported_provider' }, 400);
  }
  if (!providerEnabled(deps, provider)) {
    return c.json({ error: 'provider_disabled' }, 404);
  }
  const code = c.req.query('code') ?? '';
  const state = c.req.query('state') ?? '';
  if (code.length === 0 || state.length === 0) {
    return c.json({ error: 'missing_code_or_state' }, 400);
  }
  const r = repo(deps);
  const oauthState = await r.findOauthStateByState(state);
  if (oauthState === null || oauthState.provider !== provider) {
    return c.json({ error: 'invalid_state' }, 400);
  }

  const google = deps.providers.google;
  if (google === undefined) {
    return c.json({ error: 'provider_disabled' }, 404);
  }
  let googleUser: Awaited<ReturnType<typeof exchangeGoogleAuthorizationCode>>;
  try {
    googleUser = await exchangeGoogleAuthorizationCode({
      http: deps.http,
      google,
      redirectUri: googleRedirectUri(deps.baseURL, publicPrefix(deps)),
      code,
      codeVerifier: oauthState.code_verifier,
    });
  } catch {
    return c.json({ error: 'google_exchange_failed' }, 400);
  }
  const user = await r.upsertSocialUser({
    provider: IDP_PROVIDER_GOOGLE,
    providerUserId: googleUser.sub,
    email: googleUser.email,
    name: googleUser.name,
    image: googleUser.picture,
    accessToken: googleUser.accessToken,
    refreshToken: googleUser.refreshToken,
  });
  return finishOauthCallback({ c, deps, oauthState, user });
}

export async function handleSessionExchange(
  c: Context,
  deps: CreateAuthAppDeps
): Promise<Response> {
  const raw: unknown = await c.req.json().catch(() => null);
  const code = readStringField(raw, 'code');
  if (code.length === 0) {
    return c.json({ error: 'missing_code' }, 400);
  }
  const r = repo(deps);
  const userId = await r.consumeExchangeCode(code);
  if (userId === null) {
    return c.json({ error: 'invalid_code' }, 400);
  }
  const user = await r.findUserById(userId);
  if (user === null) {
    return c.json({ error: 'user_missing' }, 400);
  }
  const session = await r.createSession(userId);
  const body = sessionJson(user, session.token, session.expiresAtMs);
  c.header(AUTH_SET_TOKEN_HEADER, session.token);
  return c.json(body, 200);
}

export async function handleGetSession(
  c: Context,
  deps: CreateAuthAppDeps
): Promise<Response> {
  const token = readBearer(c.req.header('authorization'));
  if (token === null) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  const found = await repo(deps).findSessionByToken(token);
  if (found === null) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  return c.json(
    {
      user: found.user,
      expiresAt: found.session.expires_at,
    },
    200
  );
}

export async function handleSignOut(
  c: Context,
  deps: CreateAuthAppDeps
): Promise<Response> {
  const token = readBearer(c.req.header('authorization'));
  if (token !== null) {
    await repo(deps).deleteSessionByToken(token);
  }
  return c.json({ ok: true }, 200);
}
