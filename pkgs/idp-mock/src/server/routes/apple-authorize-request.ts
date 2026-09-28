/**
 * `GET /auth/authorize` on an Apple-flavored provider.
 *
 * Apple's rules differ from Google's in ways relying parties trip over:
 *
 * - the only scopes are `name` and `email` (`openid` is tolerated and
 *   ignored), and an empty scope is legal — it signs in without sharing
 *   anything;
 * - requesting `name` or `email` **requires** `response_mode=form_post`: the
 *   response comes back as a cross-site POST, never a query string;
 * - `code id_token` is allowed, and then `query` is not;
 * - `prompt`, `login_hint`, `access_type` and PKCE are not part of the
 *   contract and are ignored.
 *
 * Every rejection is an error page: Apple never bounces a malformed request
 * back to the relying party.
 */

import type { IdpResponseMode } from '../../shared/types';
import type { IdpStore } from '../idp-state';
import { type AuthorizeParse, validateClient } from './authorize-validate';

const APPLE_SCOPES = new Set(['name', 'email']);

function page(error: string, detail: string): AuthorizeParse {
  return {
    ok: false,
    rejection: { kind: 'page', status: 400, error, detail },
  };
}

function parseScopes(
  raw: string
): { readonly scopes: string[] } | { readonly invalid: string } {
  const scopes: string[] = [];
  for (const scope of raw.split(/[\s+]+/)) {
    if (scope.length === 0 || scope === 'openid') continue;
    if (!APPLE_SCOPES.has(scope)) return { invalid: scope };
    if (!scopes.includes(scope)) scopes.push(scope);
  }
  return { scopes };
}

function parseResponseType(raw: string): 'code' | 'code id_token' | null {
  const parts = raw
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .sort();
  const joined = parts.join(' ');
  if (joined === 'code') return 'code';
  if (joined === 'code id_token') return 'code id_token';
  return null;
}

function parseResponseMode(
  raw: string,
  responseType: 'code' | 'code id_token'
): IdpResponseMode | null {
  if (raw === '') return responseType === 'code' ? 'query' : 'fragment';
  if (raw === 'query' || raw === 'fragment' || raw === 'form_post') return raw;
  return null;
}

export async function parseAppleAuthorizeRequest(
  store: IdpStore,
  params: URLSearchParams
): Promise<AuthorizeParse> {
  const checked = await validateClient(store, params);
  if ('rejection' in checked) {
    return {
      ok: false,
      rejection: {
        kind: 'page',
        status: 400,
        error: 'invalid_client',
        detail: 'Invalid client id or web redirect url.',
      },
    };
  }
  const responseType = parseResponseType(params.get('response_type') ?? '');
  if (responseType === null) {
    return page('unsupported_response_type', 'Invalid response_type.');
  }
  const scoped = parseScopes(params.get('scope') ?? '');
  if ('invalid' in scoped) {
    return page('invalid_scope', `Invalid scope: ${scoped.invalid}`);
  }
  const mode = parseResponseMode(
    params.get('response_mode') ?? '',
    responseType
  );
  if (mode === null) return page('invalid_request', 'Invalid response_mode.');
  if (scoped.scopes.length > 0 && mode !== 'form_post') {
    return page(
      'invalid_request',
      'response_mode must be form_post when name or email scope is requested.'
    );
  }
  if (responseType === 'code id_token' && mode === 'query') {
    return page(
      'invalid_request',
      'response_mode query is not allowed with response_type code id_token.'
    );
  }
  return {
    ok: true,
    client: checked.client,
    request: {
      id: store.createId(),
      clientId: checked.client.clientId,
      redirectUri: params.get('redirect_uri') ?? '',
      scopes: scoped.scopes,
      state: params.get('state'),
      nonce: params.get('nonce'),
      codeChallenge: null,
      codeChallengeMethod: null,
      accessType: 'offline',
      prompts: [],
      loginHint: null,
      createdAtMs: store.clock.now(),
      chosenSub: null,
      identifierEmail: null,
      responseType,
      responseMode: mode,
    },
  };
}
