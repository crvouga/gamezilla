/**
 * The token endpoint — Google's `POST /token`, Apple's `POST /auth/token` —
 * for the authorization-code and refresh-token grants.
 *
 * The two differ where relying parties get hurt: Google authenticates the
 * client with a shared secret (post or Basic) and kills the whole grant when
 * a code is replayed; Apple authenticates with a signed JWT (post only),
 * answers failures with terse error codes, codes live five minutes, and every
 * grant — the refresh grant included — carries an id_token.
 */

import type { Context } from 'hono';

import { pkceS256Challenge } from '../../shared/pkce';
import type { IdpAuthCode, IdpTokenErrorBody } from '../../shared/types';
import { type IdpCtx, issuerOf } from '../idp-context';
import type { IdpStore } from '../idp-state';
import { verifyAppleClientSecret } from './apple-client-secret';
import { mintTokens } from './token-mint';

type Form = Record<string, string>;

function tokenError(
  c: Context,
  error: string,
  description: string | null,
  status: 400 | 401 | 500 = 400
): Response {
  const body: IdpTokenErrorBody =
    description === null
      ? { error }
      : { error, error_description: description };
  return c.json(body, status);
}

function basicCredentials(header: string | undefined): Form {
  if (header === undefined || !header.toLowerCase().startsWith('basic ')) {
    return {};
  }
  const decoded = Buffer.from(header.slice(6).trim(), 'base64').toString(
    'utf8'
  );
  const at = decoded.indexOf(':');
  if (at < 0) return {};
  return {
    client_id: decodeURIComponent(decoded.slice(0, at)),
    client_secret: decodeURIComponent(decoded.slice(at + 1)),
  };
}

async function readForm(c: Context, ctx: IdpCtx): Promise<Form> {
  const raw = await c.req.text();
  const params = new URLSearchParams(raw);
  const form: Form = {};
  for (const [key, value] of params) form[key] = value;
  // Apple accepts `client_secret_post` only.
  if (ctx.store.provider === 'apple') return form;
  return { ...basicCredentials(c.req.header('authorization')), ...form };
}

function verifyPkce(
  challenge: string | null,
  method: 'S256' | 'plain' | null,
  verifier: string
): string | null {
  if (challenge === null) return null;
  if (verifier.length === 0) {
    return 'Missing code verifier.';
  }
  const presented = method === 'S256' ? pkceS256Challenge(verifier) : verifier;
  return presented === challenge ? null : 'Code verifier does not match.';
}

export async function authenticateClient(
  store: IdpStore,
  form: Form
): Promise<string | null> {
  const client = await store.client(form['client_id'] ?? '');
  if (client === null) {
    return 'The OAuth client was not found.';
  }
  if (store.provider === 'apple') {
    return await verifyAppleClientSecret({
      client,
      secret: form['client_secret'] ?? '',
      nowMs: store.clock.now(),
    });
  }
  if (client.clientSecret !== (form['client_secret'] ?? '')) {
    return 'The OAuth client secret is invalid.';
  }
  return null;
}

function apple(ctx: IdpCtx): boolean {
  return ctx.store.provider === 'apple';
}

function grantError(c: Context, ctx: IdpCtx, google: string): Response {
  return tokenError(
    c,
    'invalid_grant',
    apple(ctx) ? 'The code has expired or has been revoked.' : google
  );
}

/**
 * A replayed code is a compromise: Google kills the earlier grant, so the
 * revocation and the rejection happen together. Apple just refuses.
 */
async function replayGrant(
  c: Context,
  ctx: IdpCtx,
  entry: IdpAuthCode
): Promise<Response> {
  if (!apple(ctx)) {
    await ctx.store.tx(async (store) => {
      await store.revokeGrantTokens(entry.sub, entry.clientId);
    });
  }
  return grantError(c, ctx, 'Code was already redeemed.');
}

function codeProblem(
  ctx: IdpCtx,
  entry: IdpAuthCode,
  form: Form
): string | null {
  if (entry.clientId !== (form['client_id'] ?? '')) {
    return 'Code was issued to another client.';
  }
  if (entry.redirectUri !== (form['redirect_uri'] ?? '')) {
    return 'Redirect URI mismatch.';
  }
  if (ctx.store.clock.now() > entry.expiresAtMs) return 'Code has expired.';
  return verifyPkce(
    entry.codeChallenge,
    entry.codeChallengeMethod,
    form['code_verifier'] ?? ''
  );
}

async function codeGrant(
  c: Context,
  ctx: IdpCtx,
  form: Form
): Promise<Response> {
  const entry = await ctx.store.authCode(form['code'] ?? '');
  if (entry === null) return grantError(c, ctx, 'Malformed auth code.');
  if (entry.redeemed) return await replayGrant(c, ctx, entry);
  const problem = codeProblem(ctx, entry, form);
  if (problem !== null) return grantError(c, ctx, problem);
  const account = await ctx.store.accountBySub(entry.sub);
  if (account === null) return grantError(c, ctx, 'Account no longer exists.');
  const issuer = issuerOf(ctx, c);
  const tokens = await ctx.store.tx(async (store) => {
    await store.redeemAuthCode(entry.code);
    return await mintTokens({
      store,
      subject: {
        issuer,
        account,
        clientId: entry.clientId,
        scopes: entry.scopes,
        nonce: entry.nonce,
        firstAuthorization: entry.firstAuthorization,
        authTimeMs: entry.authTimeMs,
      },
      withRefreshToken: entry.issueRefreshToken,
    });
  });
  return c.json(tokens, 200);
}

async function refreshGrant(
  c: Context,
  ctx: IdpCtx,
  form: Form
): Promise<Response> {
  const entry = await ctx.store.refreshToken(form['refresh_token'] ?? '');
  if (entry === null || entry.revoked) {
    return grantError(c, ctx, 'Token has been expired or revoked.');
  }
  if (entry.clientId !== (form['client_id'] ?? '')) {
    return grantError(c, ctx, 'Token was issued to another client.');
  }
  const account = await ctx.store.accountBySub(entry.sub);
  if (account === null) return grantError(c, ctx, 'Account no longer exists.');
  const issuer = issuerOf(ctx, c);
  const tokens = await ctx.store.tx(async (store) =>
    mintTokens({
      store,
      subject: {
        issuer,
        account,
        clientId: entry.clientId,
        scopes: entry.scopes,
        nonce: null,
        firstAuthorization: false,
        authTimeMs: store.clock.now(),
      },
      withRefreshToken: false,
    })
  );
  return c.json(tokens, 200);
}

export async function handleToken(c: Context, ctx: IdpCtx): Promise<Response> {
  await ctx.store.sweepExpired();
  const faults = await ctx.store.faults();
  if (faults.tokenEndpoint === 'server_error') {
    return tokenError(c, 'internal_failure', 'Backend Error', 500);
  }
  const form = await readForm(c, ctx);
  if (faults.tokenEndpoint === 'invalid_client') {
    return tokenError(
      c,
      'invalid_client',
      apple(ctx) ? null : 'Unauthorized',
      401
    );
  }
  const clientError = await authenticateClient(ctx.store, form);
  if (clientError !== null) {
    return apple(ctx)
      ? tokenError(c, 'invalid_client', null, 400)
      : tokenError(c, 'invalid_client', clientError, 401);
  }
  const grantType = form['grant_type'] ?? '';
  if (grantType === 'authorization_code') return await codeGrant(c, ctx, form);
  if (grantType === 'refresh_token') return await refreshGrant(c, ctx, form);
  return tokenError(
    c,
    'unsupported_grant_type',
    apple(ctx) ? null : `Invalid grant_type: ${grantType}`
  );
}
