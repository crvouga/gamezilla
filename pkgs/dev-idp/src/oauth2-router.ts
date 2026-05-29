/**
 * Hono router for the local OAuth2 / OIDC identity provider. Exposes the
 * standard `/authorize`, `/token`, `/userinfo` triplet plus a `/users`
 * CRUD surface that powers the JSX account-chooser web view
 * ({@link ./ui/page}). The router is purely a wire-level adapter — all
 * persistence flows through the injected {@link Kv}.
 *
 * The factory is intentionally side-effect-free: the consumer (the
 * standalone {@link ./dev-server} or a future embedder) decides when to
 * construct it and seeds the default test users themselves.
 */
import type { Kv } from '@pkgs/kv/interface';
import { Hono } from 'hono';

import type { ClientBundle } from './client-bundle';
import {
  DEV_IDP_CLIENT_ID,
  DEV_IDP_CLIENT_SECRET,
  DEV_IDP_ENDPOINTS,
  DEV_IDP_PATH_PREFIX,
  DEV_IDP_SCOPES,
} from './config';
import {
  DevIdpUserStore,
  type DevIdpUserCreateInput,
  type DevIdpUserPatch,
} from './dev-idp-user-store';
import {
  consumeAuthCode,
  issueAccessToken,
  issueAuthCode,
  lookupAccessToken,
  userInfoFromProfile,
  verifyPkce,
} from './oauth2-core';
import { renderChooserPage } from './ui/render';

/**
 * Resolver for the durable {@link Kv}. The dev IdP router is constructed once
 * (at app boot), but its host environment may only expose a `Kv` per request
 * (e.g. Cloudflare Workers + Hyperdrive: a fresh `pg.Client` per request).
 * Pass a callback that returns the live durable `Kv` for the current call.
 */
export type DevIdpGetKv = () => Kv;

export type DevIdpRouterOptions = {
  /** Resolver for the durable KV used for user / code / token storage. */
  readonly getKv: DevIdpGetKv;
  /**
   * Pre-built client JS bundle served from `/client.js` (relative to the
   * router's mount prefix). The chooser page references it via a
   * `<script type="module">`; without it the page renders the static
   * shell only.
   */
  readonly clientBundle: ClientBundle;
};

const CLIENT_BUNDLE_PATH = '/client.js';

/** Constructs the dev IdP Hono router. Mount under {@link DEV_IDP_PATH_PREFIX}. */
export function createDevIdpRouter(options: DevIdpRouterOptions): Hono {
  const { getKv, clientBundle } = options;
  const app = new Hono();

  app.get(DEV_IDP_ENDPOINTS.authorize, async (c) => {
    const kv = getKv();
    const users = await new DevIdpUserStore(kv).list();
    return await handleAuthorizeGet(c.req.raw.url, users);
  });
  app.get(
    CLIENT_BUNDLE_PATH,
    () =>
      new Response(clientBundle.js, {
        status: 200,
        headers: {
          'content-type': 'application/javascript; charset=utf-8',
          'cache-control': 'no-store',
        },
      })
  );
  app.post(DEV_IDP_ENDPOINTS.authorizeComplete, async (c) => {
    const body = await readForm(c.req.raw);
    const kv = getKv();
    return handleAuthorizeComplete(kv, new DevIdpUserStore(kv), body);
  });
  app.post(DEV_IDP_ENDPOINTS.token, async (c) => {
    const body = await readForm(c.req.raw);
    return handleToken(getKv(), body);
  });
  app.get(DEV_IDP_ENDPOINTS.userinfo, async (c) => {
    const kv = getKv();
    return handleUserInfo(
      kv,
      new DevIdpUserStore(kv),
      c.req.header('authorization') ?? null
    );
  });

  registerUsersRoutes(app, getKv);
  return app;
}

function registerUsersRoutes(app: Hono, getKv: DevIdpGetKv): void {
  app.get(DEV_IDP_ENDPOINTS.users, async () => {
    const list = await new DevIdpUserStore(getKv()).list();
    return Response.json(list);
  });
  app.post(DEV_IDP_ENDPOINTS.users, async (c) => {
    const body = (await readJsonOrEmpty(c.req.raw)) as Record<string, unknown>;
    return handleCreateUser(new DevIdpUserStore(getKv()), body);
  });
  app.get(`${DEV_IDP_ENDPOINTS.users}/:sub`, async (c) => {
    const profile = await new DevIdpUserStore(getKv()).get(c.req.param('sub'));
    if (profile === null)
      return Response.json({ error: 'not_found' }, { status: 404 });
    return Response.json(profile);
  });
  app.patch(`${DEV_IDP_ENDPOINTS.users}/:sub`, async (c) => {
    const body = (await readJsonOrEmpty(c.req.raw)) as Record<string, unknown>;
    return handleUpdateUser(
      new DevIdpUserStore(getKv()),
      c.req.param('sub'),
      body
    );
  });
  app.delete(`${DEV_IDP_ENDPOINTS.users}/:sub`, async (c) => {
    const deleted = await new DevIdpUserStore(getKv()).delete(
      c.req.param('sub')
    );
    if (!deleted) return Response.json({ error: 'not_found' }, { status: 404 });
    return new Response(null, { status: 204 });
  });
}

async function handleAuthorizeGet(
  rawUrl: string,
  initialUsers: Awaited<ReturnType<DevIdpUserStore['list']>>
): Promise<Response> {
  const url = new URL(rawUrl);
  const oauthParams: Record<string, string> = {};
  for (const [k, v] of url.searchParams) {
    oauthParams[k] = v;
  }
  const completeActionPath = `${DEV_IDP_PATH_PREFIX}${DEV_IDP_ENDPOINTS.authorizeComplete}`;
  const usersApiPath = `${DEV_IDP_PATH_PREFIX}${DEV_IDP_ENDPOINTS.users}`;
  const html = await renderChooserPage({
    config: {
      completeActionPath,
      usersApiPath,
      oauthParams,
      initialUsers,
    },
    clientBundleUrl: `${DEV_IDP_PATH_PREFIX}${CLIENT_BUNDLE_PATH}`,
  });
  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

async function handleAuthorizeComplete(
  kv: Kv,
  store: DevIdpUserStore,
  body: Record<string, string>
): Promise<Response> {
  const error = validateAuthorizeRequest(body);
  if (error !== null) return oauthError(body, error.code, error.description);
  const sub = body['sub'] ?? '';
  const profile = await store.get(sub);
  if (profile === null) {
    return oauthError(body, 'access_denied', `unknown test account: ${sub}`);
  }
  const code = await issueAuthCode(kv, {
    userSub: profile.sub,
    clientId: body['client_id'] ?? '',
    redirectUri: body['redirect_uri'] ?? '',
    scope: body['scope'] ?? DEV_IDP_SCOPES.join(' '),
    state: emptyToNull(body['state']),
    nonce: emptyToNull(body['nonce']),
    codeChallenge: emptyToNull(body['code_challenge']),
    codeChallengeMethod: emptyToNull(body['code_challenge_method']),
  });
  const redirect = new URL(body['redirect_uri'] ?? '');
  redirect.searchParams.set('code', code.code);
  if (code.state !== null) redirect.searchParams.set('state', code.state);
  return Response.redirect(redirect.toString(), 302);
}

type OauthErr = { readonly code: string; readonly description: string };

function validateAuthorizeRequest(
  body: Record<string, string>
): OauthErr | null {
  const responseType = body['response_type'] ?? 'code';
  if (responseType !== 'code') {
    return {
      code: 'unsupported_response_type',
      description: `response_type=${responseType} is not supported`,
    };
  }
  if ((body['client_id'] ?? '') !== DEV_IDP_CLIENT_ID) {
    return { code: 'unauthorized_client', description: 'unknown client_id' };
  }
  const redirect = body['redirect_uri'] ?? '';
  if (!isAcceptableRedirectUri(redirect)) {
    return {
      code: 'invalid_request',
      description: 'redirect_uri must be an absolute http(s) URL',
    };
  }
  return null;
}

function isAcceptableRedirectUri(value: string): boolean {
  if (value.length === 0) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function oauthError(
  body: Record<string, string>,
  code: string,
  description: string
): Response {
  const redirect = body['redirect_uri'] ?? '';
  if (!isAcceptableRedirectUri(redirect)) {
    return Response.json(
      { error: code, error_description: description },
      { status: 400 }
    );
  }
  const url = new URL(redirect);
  url.searchParams.set('error', code);
  url.searchParams.set('error_description', description);
  if (typeof body['state'] === 'string' && body['state'].length > 0) {
    url.searchParams.set('state', body['state']);
  }
  return Response.redirect(url.toString(), 302);
}

async function handleToken(
  kv: Kv,
  body: Record<string, string>
): Promise<Response> {
  if ((body['grant_type'] ?? '') !== 'authorization_code') {
    return tokenError(
      'unsupported_grant_type',
      'only authorization_code supported'
    );
  }
  const clientError = validateTokenClient(body);
  if (clientError !== null) return clientError;
  const code = await consumeAuthCode(kv, body['code'] ?? '');
  if (code === null) {
    return tokenError(
      'invalid_grant',
      'authorization code is invalid or expired'
    );
  }
  if (code.redirectUri !== (body['redirect_uri'] ?? '')) {
    return tokenError('invalid_grant', 'redirect_uri mismatch');
  }
  const pkceErr = await checkPkce(code, body['code_verifier'] ?? '');
  if (pkceErr !== null) return pkceErr;
  const token = await issueAccessToken(kv, {
    userSub: code.userSub,
    scope: code.scope,
  });
  return Response.json(
    {
      access_token: token.token,
      token_type: 'Bearer',
      expires_in: Math.floor((token.expiresAtMs - token.issuedAtMs) / 1000),
      scope: token.scope,
    },
    {
      status: 200,
      headers: {
        'cache-control': 'no-store',
        pragma: 'no-cache',
      },
    }
  );
}

function validateTokenClient(body: Record<string, string>): Response | null {
  const clientId = body['client_id'] ?? '';
  const clientSecret = body['client_secret'] ?? '';
  if (clientId !== DEV_IDP_CLIENT_ID) {
    return tokenError('invalid_client', 'unknown client_id');
  }
  if (clientSecret !== DEV_IDP_CLIENT_SECRET) {
    return tokenError('invalid_client', 'invalid client_secret');
  }
  return null;
}

async function checkPkce(
  code: { codeChallenge: string | null; codeChallengeMethod: string | null },
  verifier: string
): Promise<Response | null> {
  if (code.codeChallenge === null) return null;
  if (verifier.length === 0) {
    return tokenError('invalid_grant', 'code_verifier required');
  }
  const ok = await verifyPkce({
    verifier,
    challenge: code.codeChallenge,
    method: code.codeChallengeMethod ?? 'plain',
  });
  if (!ok) return tokenError('invalid_grant', 'PKCE verification failed');
  return null;
}

function tokenError(code: string, description: string): Response {
  return Response.json(
    { error: code, error_description: description },
    { status: 400, headers: { 'cache-control': 'no-store' } }
  );
}

async function handleUserInfo(
  kv: Kv,
  store: DevIdpUserStore,
  authHeader: string | null
): Promise<Response> {
  if (authHeader === null || !authHeader.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 });
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const lookup = await lookupAccessToken(kv, token);
  if (lookup === null) {
    return new Response('Unauthorized', { status: 401 });
  }
  const profile = await store.get(lookup.userSub);
  if (profile === null) {
    return new Response('Unauthorized', { status: 401 });
  }
  return Response.json(userInfoFromProfile(profile));
}

async function handleCreateUser(
  store: DevIdpUserStore,
  body: Record<string, unknown>
): Promise<Response> {
  const input = readCreateInput(body);
  if (input === null) {
    return Response.json(
      {
        error: 'invalid_request',
        error_description: 'email and name required',
      },
      { status: 400 }
    );
  }
  const created = await store.create(input);
  return Response.json(created, { status: 201 });
}

async function handleUpdateUser(
  store: DevIdpUserStore,
  sub: string,
  body: Record<string, unknown>
): Promise<Response> {
  const patch: DevIdpUserPatch = {};
  if (typeof body['email'] === 'string') {
    (patch as Record<string, unknown>)['email'] = body['email'];
  }
  if (typeof body['name'] === 'string') {
    (patch as Record<string, unknown>)['name'] = body['name'];
  }
  if (Object.prototype.hasOwnProperty.call(body, 'picture')) {
    const p = body['picture'];
    (patch as Record<string, unknown>)['picture'] =
      typeof p === 'string' ? p : null;
  }
  const next = await store.update(sub, patch);
  if (next === null)
    return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json(next);
}

function readCreateInput(
  body: Record<string, unknown>
): DevIdpUserCreateInput | null {
  const email = readString(body['email']);
  const name = readString(body['name']);
  if (email === null || name === null) return null;
  const picture = body['picture'];
  const input: DevIdpUserCreateInput = { email, name };
  if (typeof picture === 'string' && picture.length > 0) {
    return { ...input, picture };
  }
  if (picture === null) return { ...input, picture: null };
  return input;
}

function readString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function emptyToNull(value: string | undefined): string | null {
  if (value === undefined || value.length === 0) return null;
  return value;
}

async function readForm(req: Request): Promise<Record<string, string>> {
  try {
    const text = await req.clone().text();
    const params = new URLSearchParams(text);
    const out: Record<string, string> = {};
    params.forEach((v, k) => {
      out[k] = v;
    });
    return out;
  } catch {
    return {};
  }
}

async function readJsonOrEmpty(req: Request): Promise<unknown> {
  try {
    return await req.clone().json();
  } catch {
    return {};
  }
}
