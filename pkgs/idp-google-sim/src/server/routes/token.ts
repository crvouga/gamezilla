/** `POST /token` — the authorization-code and refresh-token grants. */

import type { Context } from 'hono';

import { pkceS256Challenge } from '../../shared/pkce';
import type { IdpTokenErrorBody } from '../../shared/types';
import { type IdpCtx, issuerOf } from '../idp-context';
import type { IdpStore } from '../idp-state';
import { mintTokens } from './token-mint';

type Form = Record<string, string>;

function tokenError(
  c: Context,
  error: string,
  description: string,
  status: 400 | 401 | 500 = 400
): Response {
  const body: IdpTokenErrorBody = { error, error_description: description };
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

async function readForm(c: Context): Promise<Form> {
  const raw = await c.req.text();
  const params = new URLSearchParams(raw);
  const form: Form = {};
  for (const [key, value] of params) form[key] = value;
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

async function authenticateClient(
  store: IdpStore,
  form: Form
): Promise<string | null> {
  const client = await store.client(form['client_id'] ?? '');
  if (client === null) {
    return 'The OAuth client was not found.';
  }
  if (client.clientSecret !== (form['client_secret'] ?? '')) {
    return 'The OAuth client secret is invalid.';
  }
  return null;
}

/**
 * A replayed code is a compromise: Google kills the earlier grant, so the
 * revocation and the rejection happen together.
 */
async function replayGrant(
  c: Context,
  ctx: IdpCtx,
  sub: string,
  clientId: string
): Promise<Response> {
  await ctx.store.tx(async (store) => {
    await store.revokeGrantTokens(sub, clientId);
  });
  return tokenError(c, 'invalid_grant', 'Code was already redeemed.');
}

async function codeGrant(
  c: Context,
  ctx: IdpCtx,
  form: Form
): Promise<Response> {
  const entry = await ctx.store.authCode(form['code'] ?? '');
  if (entry === null) {
    return tokenError(c, 'invalid_grant', 'Malformed auth code.');
  }
  if (entry.redeemed) {
    return await replayGrant(c, ctx, entry.sub, entry.clientId);
  }
  if (entry.clientId !== (form['client_id'] ?? '')) {
    return tokenError(c, 'invalid_grant', 'Code was issued to another client.');
  }
  if (entry.redirectUri !== (form['redirect_uri'] ?? '')) {
    return tokenError(c, 'invalid_grant', 'Redirect URI mismatch.');
  }
  if (ctx.store.clock.now() > entry.expiresAtMs) {
    return tokenError(c, 'invalid_grant', 'Code has expired.');
  }
  const pkceError = verifyPkce(
    entry.codeChallenge,
    entry.codeChallengeMethod,
    form['code_verifier'] ?? ''
  );
  if (pkceError !== null) return tokenError(c, 'invalid_grant', pkceError);
  const account = await ctx.store.accountBySub(entry.sub);
  if (account === null) {
    return tokenError(c, 'invalid_grant', 'Account no longer exists.');
  }
  const issuer = issuerOf(ctx, c);
  const tokens = await ctx.store.tx(async (store) => {
    await store.redeemAuthCode(entry.code);
    return await mintTokens({
      store,
      issuer,
      account,
      grant: {
        clientId: entry.clientId,
        scopes: entry.scopes,
        nonce: entry.nonce,
        withRefreshToken: entry.issueRefreshToken,
      },
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
    return tokenError(c, 'invalid_grant', 'Token has been expired or revoked.');
  }
  if (entry.clientId !== (form['client_id'] ?? '')) {
    return tokenError(
      c,
      'invalid_grant',
      'Token was issued to another client.'
    );
  }
  const account = await ctx.store.accountBySub(entry.sub);
  if (account === null) {
    return tokenError(c, 'invalid_grant', 'Account no longer exists.');
  }
  const issuer = issuerOf(ctx, c);
  const tokens = await ctx.store.tx(async (store) =>
    mintTokens({
      store,
      issuer,
      account,
      grant: {
        clientId: entry.clientId,
        scopes: entry.scopes,
        nonce: null,
        withRefreshToken: false,
      },
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
  const form = await readForm(c);
  if (faults.tokenEndpoint === 'invalid_client') {
    return tokenError(c, 'invalid_client', 'Unauthorized', 401);
  }
  const clientError = await authenticateClient(ctx.store, form);
  if (clientError !== null) {
    return tokenError(c, 'invalid_client', clientError, 401);
  }
  const grantType = form['grant_type'] ?? '';
  if (grantType === 'authorization_code') return await codeGrant(c, ctx, form);
  if (grantType === 'refresh_token') return await refreshGrant(c, ctx, form);
  return tokenError(
    c,
    'unsupported_grant_type',
    `Invalid grant_type: ${grantType}`
  );
}
