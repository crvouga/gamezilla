/** `POST /token` — the authorization-code and refresh-token grants. */

import type { Context } from 'hono';

import { pkceS256Challenge } from '../../shared/pkce';
import type { IdpTokenErrorBody } from '../../shared/types';
import { type IdpCtx, issuerOf } from '../idp-context';
import { revokeGrantTokens, sweepExpired } from '../idp-state';
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

function authenticateClient(ctx: IdpCtx, form: Form): string | null {
  const client = ctx.state.clients.get(form['client_id'] ?? '');
  if (client === undefined) {
    return 'The OAuth client was not found.';
  }
  if (client.clientSecret !== (form['client_secret'] ?? '')) {
    return 'The OAuth client secret is invalid.';
  }
  return null;
}

async function codeGrant(
  c: Context,
  ctx: IdpCtx,
  form: Form
): Promise<Response> {
  const entry = ctx.state.authCodes.get(form['code'] ?? '');
  if (entry === undefined) {
    return tokenError(c, 'invalid_grant', 'Malformed auth code.');
  }
  if (entry.redeemed) {
    // Google treats a replayed code as a compromise and kills the grant.
    revokeGrantTokens(ctx.state, entry.sub, entry.clientId);
    return tokenError(c, 'invalid_grant', 'Code was already redeemed.');
  }
  if (entry.clientId !== (form['client_id'] ?? '')) {
    return tokenError(c, 'invalid_grant', 'Code was issued to another client.');
  }
  if (entry.redirectUri !== (form['redirect_uri'] ?? '')) {
    return tokenError(c, 'invalid_grant', 'Redirect URI mismatch.');
  }
  if (ctx.state.clock.now() > entry.expiresAtMs) {
    return tokenError(c, 'invalid_grant', 'Code has expired.');
  }
  const pkceError = verifyPkce(
    entry.codeChallenge,
    entry.codeChallengeMethod,
    form['code_verifier'] ?? ''
  );
  if (pkceError !== null) return tokenError(c, 'invalid_grant', pkceError);
  const account = ctx.state.accounts.get(entry.sub);
  if (account === undefined) {
    return tokenError(c, 'invalid_grant', 'Account no longer exists.');
  }
  entry.redeemed = true;
  const tokens = await mintTokens({
    ctx,
    issuer: issuerOf(ctx, c),
    account,
    grant: {
      clientId: entry.clientId,
      scopes: entry.scopes,
      nonce: entry.nonce,
      withRefreshToken: entry.issueRefreshToken,
    },
  });
  return c.json(tokens, 200);
}

async function refreshGrant(
  c: Context,
  ctx: IdpCtx,
  form: Form
): Promise<Response> {
  const entry = ctx.state.refreshTokens.get(form['refresh_token'] ?? '');
  if (entry === undefined || entry.revoked) {
    return tokenError(c, 'invalid_grant', 'Token has been expired or revoked.');
  }
  if (entry.clientId !== (form['client_id'] ?? '')) {
    return tokenError(
      c,
      'invalid_grant',
      'Token was issued to another client.'
    );
  }
  const account = ctx.state.accounts.get(entry.sub);
  if (account === undefined) {
    return tokenError(c, 'invalid_grant', 'Account no longer exists.');
  }
  const tokens = await mintTokens({
    ctx,
    issuer: issuerOf(ctx, c),
    account,
    grant: {
      clientId: entry.clientId,
      scopes: entry.scopes,
      nonce: null,
      withRefreshToken: false,
    },
  });
  return c.json(tokens, 200);
}

export async function handleToken(c: Context, ctx: IdpCtx): Promise<Response> {
  sweepExpired(ctx.state);
  if (ctx.state.faults.tokenEndpoint === 'server_error') {
    return tokenError(c, 'internal_failure', 'Backend Error', 500);
  }
  const form = await readForm(c);
  if (ctx.state.faults.tokenEndpoint === 'invalid_client') {
    return tokenError(c, 'invalid_client', 'Unauthorized', 401);
  }
  const clientError = authenticateClient(ctx, form);
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
