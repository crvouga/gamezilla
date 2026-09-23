import type { Context } from 'hono';

import {
  AUTH_SET_TOKEN_HEADER,
  IDP_PROVIDER_APPLE,
  IDP_PROVIDER_DEV,
  IDP_PROVIDER_GOOGLE,
} from '../shared/auth-constants';
import { isTrustedCallbackUrl } from '../shared/trusted-origins';
import { buildAppleAuthorizationUrl } from './apple-oauth';
import type { CreateAuthAppDeps } from './create-auth-app-types';
import {
  buildDevAuthorizeUrl,
  devAuthorizeCompletePath,
  devRedirectUri,
  renderDevAuthorizePage,
} from './dev-oauth';
import { buildGoogleAuthorizationUrl } from './google-oauth';
import { IdpRepository } from './idp-repository';
import {
  finishOauthCallback,
  handleAppleCallback,
  handleGoogleCallback,
} from './oauth-social';

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
  return (
    provider === IDP_PROVIDER_GOOGLE ||
    provider === IDP_PROVIDER_APPLE ||
    provider === IDP_PROVIDER_DEV
  );
}

function providerEnabled(deps: CreateAuthAppDeps, provider: string): boolean {
  if (provider === IDP_PROVIDER_GOOGLE) {
    return deps.providers.google !== undefined;
  }
  if (provider === IDP_PROVIDER_APPLE) {
    return deps.providers.apple !== undefined;
  }
  if (provider === IDP_PROVIDER_DEV) {
    return deps.providers.dev?.enabled === true;
  }
  return false;
}

async function callbackFields(c: Context): Promise<{
  code: string;
  state: string;
  idToken: string;
}> {
  if (c.req.method === 'GET') {
    return {
      code: c.req.query('code') ?? '',
      state: c.req.query('state') ?? '',
      idToken: '',
    };
  }
  const body = await c.req.parseBody();
  const field = (key: string) => {
    const value = body[key];
    return typeof value === 'string' ? value.trim() : '';
  };
  return {
    code: field('code'),
    state: field('state'),
    idToken: field('id_token'),
  };
}

async function linkSessionUserId(
  c: Context,
  deps: CreateAuthAppDeps
): Promise<string | null | 'unauthorized'> {
  if (c.req.query('intent') !== 'link') return null;
  const token = readBearer(c.req.header('authorization'));
  if (token === null) return 'unauthorized';
  const found = await repo(deps).findSessionByToken(token);
  if (found === null) return 'unauthorized';
  return found.user.id;
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
  const linkUserId = await linkSessionUserId(c, deps);
  if (linkUserId === 'unauthorized') {
    return c.json({ error: 'unauthorized' }, 401);
  }
  const r = repo(deps);
  const { state, codeVerifier } = await r.createOauthState({
    provider,
    callbackUrl,
    ...(linkUserId !== null ? { userId: linkUserId } : {}),
  });
  const prefix = publicPrefix(deps);
  if (provider === IDP_PROVIDER_APPLE) {
    if (deps.providers.apple === undefined) {
      return c.json({ error: 'provider_disabled' }, 404);
    }
    return c.redirect(
      buildAppleAuthorizationUrl({
        clientId: deps.providers.apple.clientId,
        redirectUri: providerCallbackUri(
          deps.baseURL,
          prefix,
          IDP_PROVIDER_APPLE
        ),
        state,
        nonce: codeVerifier,
      }),
      302
    );
  }
  if (provider === IDP_PROVIDER_GOOGLE) {
    if (deps.providers.google === undefined) {
      return c.json({ error: 'provider_disabled' }, 404);
    }
    const authorizationUrl = buildGoogleAuthorizationUrl({
      clientId: deps.providers.google.clientId,
      redirectUri: googleRedirectUri(deps.baseURL, prefix),
      state,
      codeVerifier,
    });
    return c.redirect(authorizationUrl, 302);
  }
  const authorizeUrl = buildDevAuthorizeUrl({
    baseURL: deps.baseURL,
    publicPathPrefix: prefix,
    state,
  });
  return c.redirect(authorizeUrl, 302);
}

export async function handleDevAuthorize(
  c: Context,
  deps: CreateAuthAppDeps
): Promise<Response> {
  if (deps.providers.dev?.enabled !== true) {
    return c.json({ error: 'provider_disabled' }, 404);
  }
  const state = c.req.query('state') ?? '';
  if (state.length === 0) {
    return c.json({ error: 'missing_state' }, 400);
  }
  const oauthState = await repo(deps).findOauthStateByState(state);
  if (oauthState === null || oauthState.provider !== IDP_PROVIDER_DEV) {
    return c.json({ error: 'invalid_state' }, 400);
  }
  const accounts = await repo(deps).listDevAccounts();
  const html = renderDevAuthorizePage({
    state,
    completePath: devAuthorizeCompletePath(publicPrefix(deps)),
    accounts,
  });
  return c.html(html, 200);
}

export async function handleDevAuthorizeComplete(
  c: Context,
  deps: CreateAuthAppDeps
): Promise<Response> {
  if (deps.providers.dev?.enabled !== true) {
    return c.json({ error: 'provider_disabled' }, 404);
  }
  const body = await c.req.parseBody();
  const state = typeof body['state'] === 'string' ? body['state'].trim() : '';
  const subject =
    typeof body['subject'] === 'string' ? body['subject'].trim() : '';
  if (state.length === 0 || subject.length === 0) {
    return c.json({ error: 'missing_state_or_subject' }, 400);
  }
  const r = repo(deps);
  const oauthState = await r.findOauthStateByState(state);
  if (oauthState === null || oauthState.provider !== IDP_PROVIDER_DEV) {
    return c.json({ error: 'invalid_state' }, 400);
  }
  const authCode = deps.createId();
  await r.attachProviderAuthCode({
    oauthStateId: oauthState.id,
    authCode,
    providerUserId: subject,
  });
  const callback = new URL(devRedirectUri(deps.baseURL, publicPrefix(deps)));
  callback.searchParams.set('code', authCode);
  callback.searchParams.set('state', state);
  return c.redirect(callback.toString(), 302);
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
  const fields = await callbackFields(c);
  if (fields.code.length === 0 || fields.state.length === 0) {
    return c.json({ error: 'missing_code_or_state' }, 400);
  }
  const r = repo(deps);
  const oauthState = await r.findOauthStateByState(fields.state);
  if (oauthState === null || oauthState.provider !== provider) {
    return c.json({ error: 'invalid_state' }, 400);
  }
  if (provider === IDP_PROVIDER_GOOGLE) {
    return handleGoogleCallback(c, deps, fields.code, oauthState);
  }
  if (provider === IDP_PROVIDER_APPLE) {
    return handleAppleCallback(c, deps, fields.idToken, oauthState);
  }
  const subject = await r.consumeProviderAuthCode({
    authCode: fields.code,
    oauthStateId: oauthState.id,
  });
  if (subject === null) return c.json({ error: 'invalid_code' }, 400);
  const user = await r.upsertSocialUser({
    provider: IDP_PROVIDER_DEV,
    providerUserId: subject,
    email: `${subject}@dev.local`,
    name: subject,
    image: null,
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

export async function handleUnlinkAccount(
  c: Context,
  deps: CreateAuthAppDeps
): Promise<Response> {
  const token = readBearer(c.req.header('authorization'));
  if (token === null) return c.json({ error: 'unauthorized' }, 401);
  const found = await repo(deps).findSessionByToken(token);
  if (found === null) return c.json({ error: 'unauthorized' }, 401);
  const raw: unknown = await c.req.json().catch(() => null);
  const provider = readStringField(raw, 'provider');
  const subject = readStringField(raw, 'subject');
  if (provider.length === 0 || subject.length === 0) {
    return c.json({ error: 'missing_provider' }, 400);
  }
  const accounts = await repo(deps).listAccounts(found.user.id);
  const match = accounts.find(
    (account) =>
      account.provider === provider && account.provider_user_id === subject
  );
  if (match === undefined) return c.json({ error: 'not_linked' }, 404);
  if (accounts.length <= 1) return c.json({ error: 'last_account' }, 409);
  await repo(deps).deleteAccount(match.id);
  return c.json({ ok: true }, 200);
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
