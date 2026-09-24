/** `/v1/userinfo`, `/tokeninfo`, `/revoke` — the bearer-token surface. */

import type { Context } from 'hono';

import type { IdpCtx } from '../idp-context';

function bearer(c: Context): string | null {
  const header = c.req.header('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim() ?? '';
  return token.length > 0 ? token : null;
}

function unauthorized(c: Context, description: string): Response {
  c.header(
    'WWW-Authenticate',
    `Bearer realm="https://accounts.google.com/", error="invalid_token"`
  );
  return c.json(
    { error: { code: 401, message: description, status: 'UNAUTHENTICATED' } },
    401
  );
}

export async function handleUserinfo(
  c: Context,
  ctx: IdpCtx
): Promise<Response> {
  await ctx.store.sweepExpired();
  const faults = await ctx.store.faults();
  if (faults.userinfoEndpoint === 'server_error') {
    return c.json(
      { error: { code: 500, message: 'Backend Error', status: 'INTERNAL' } },
      500
    );
  }
  if (faults.userinfoEndpoint === 'unauthorized') {
    return unauthorized(c, 'Invalid Credentials');
  }
  const token = bearer(c);
  const entry = token === null ? null : await ctx.store.accessToken(token);
  if (entry === null) return unauthorized(c, 'Invalid Credentials');
  if (!entry.scopes.includes('openid')) {
    return c.json(
      {
        error: {
          code: 403,
          message: 'Request had insufficient authentication scopes.',
          status: 'PERMISSION_DENIED',
        },
      },
      403
    );
  }
  const account = await ctx.store.accountBySub(entry.sub);
  if (account === null) return unauthorized(c, 'Invalid Credentials');
  return c.json(
    {
      sub: account.sub,
      name: account.name,
      given_name: account.givenName,
      family_name: account.familyName,
      picture: account.picture,
      ...(entry.scopes.includes('email')
        ? { email: account.email, email_verified: account.emailVerified }
        : {}),
      ...(account.hd === null ? {} : { hd: account.hd }),
    },
    200
  );
}

export async function handleTokenInfo(
  c: Context,
  ctx: IdpCtx
): Promise<Response> {
  await ctx.store.sweepExpired();
  const token =
    c.req.query('access_token') ?? c.req.query('id_token') ?? bearer(c) ?? '';
  const entry = await ctx.store.accessToken(token);
  if (entry === null) {
    return c.json(
      { error: 'invalid_token', error_description: 'Invalid Value' },
      400
    );
  }
  const expiresIn = Math.max(
    0,
    Math.floor((entry.expiresAtMs - ctx.store.clock.now()) / 1000)
  );
  return c.json(
    {
      azp: entry.clientId,
      aud: entry.clientId,
      sub: entry.sub,
      scope: entry.scopes.join(' '),
      exp: String(Math.floor(entry.expiresAtMs / 1000)),
      expires_in: String(expiresIn),
      access_type: 'online',
    },
    200
  );
}

export async function handleRevoke(c: Context, ctx: IdpCtx): Promise<Response> {
  const body = new URLSearchParams(await c.req.text());
  const token = body.get('token') ?? c.req.query('token') ?? '';
  const access = await ctx.store.accessToken(token);
  if (access !== null) {
    await ctx.store.deleteAccessToken(token);
    return c.body(null, 200);
  }
  const refresh = await ctx.store.refreshToken(token);
  if (refresh !== null) {
    await ctx.store.revokeRefreshToken(token);
    return c.body(null, 200);
  }
  return c.json({ error: 'invalid_token' }, 400);
}
