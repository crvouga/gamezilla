/**
 * Parsing + validation for `/o/oauth2/v2/auth`.
 *
 * Google splits failures in two: requests it cannot trust the redirect of
 * (unknown client, unregistered URI) render an error page, everything else
 * bounces back to the app as `?error=`. That split is the whole reason a
 * relying party's error handling is hard to get right, so it is reproduced.
 */

import type { IdpAuthRequest, IdpClient, IdpPrompt } from '../../shared/types';
import type { IdpState } from '../idp-state';

export type AuthorizeRejection =
  | {
      readonly kind: 'page';
      readonly status: number;
      readonly error: string;
      readonly detail: string;
    }
  | {
      readonly kind: 'redirect';
      readonly error: string;
      readonly detail: string;
    };

export type AuthorizeParse =
  | {
      readonly ok: true;
      readonly client: IdpClient;
      readonly request: IdpAuthRequest;
    }
  | { readonly ok: false; readonly rejection: AuthorizeRejection };

const KNOWN_PROMPTS: readonly IdpPrompt[] = [
  'none',
  'consent',
  'select_account',
  'login',
];

function parsePrompts(raw: string): readonly IdpPrompt[] {
  return raw
    .split(/\s+/)
    .filter((value) => value.length > 0)
    .filter((value): value is IdpPrompt =>
      KNOWN_PROMPTS.includes(value as IdpPrompt)
    );
}

function parseChallengeMethod(
  raw: string,
  challenge: string
): 'S256' | 'plain' | null | 'invalid' {
  if (challenge.length === 0) return raw.length === 0 ? null : 'invalid';
  if (raw === '' || raw === 'plain') return 'plain';
  if (raw === 'S256') return 'S256';
  return 'invalid';
}

function rejectRedirect(error: string, detail: string): AuthorizeParse {
  return { ok: false, rejection: { kind: 'redirect', error, detail } };
}

function validateClient(
  state: IdpState,
  params: URLSearchParams
): { readonly client: IdpClient } | { readonly rejection: AuthorizeRejection } {
  const clientId = params.get('client_id') ?? '';
  const redirectUri = params.get('redirect_uri') ?? '';
  const client = state.clients.get(clientId);
  if (client === undefined) {
    return {
      rejection: {
        kind: 'page',
        status: 401,
        error: 'invalid_client',
        detail: 'The OAuth client was not found.',
      },
    };
  }
  if (!client.redirectUris.includes(redirectUri)) {
    return {
      rejection: {
        kind: 'page',
        status: 400,
        error: 'redirect_uri_mismatch',
        detail: `The redirect URI in the request, ${redirectUri}, does not match the ones authorized for the OAuth client.`,
      },
    };
  }
  return { client };
}

export function parseAuthorizeRequest(
  state: IdpState,
  params: URLSearchParams
): AuthorizeParse {
  const checked = validateClient(state, params);
  if ('rejection' in checked) {
    return { ok: false, rejection: checked.rejection };
  }
  if ((params.get('response_type') ?? '') !== 'code') {
    return rejectRedirect(
      'unsupported_response_type',
      'Only the authorization code response type is supported.'
    );
  }
  const scopes = (params.get('scope') ?? '')
    .split(/\s+/)
    .filter((scope) => scope.length > 0);
  if (scopes.length === 0) {
    return rejectRedirect(
      'invalid_request',
      'Missing required parameter: scope'
    );
  }
  const challenge = params.get('code_challenge') ?? '';
  const method = parseChallengeMethod(
    params.get('code_challenge_method') ?? '',
    challenge
  );
  if (method === 'invalid') {
    return rejectRedirect(
      'invalid_request',
      'Invalid parameter value for code_challenge_method.'
    );
  }
  return {
    ok: true,
    client: checked.client,
    request: {
      id: state.createId(),
      clientId: checked.client.clientId,
      redirectUri: params.get('redirect_uri') ?? '',
      scopes,
      state: params.get('state'),
      nonce: params.get('nonce'),
      codeChallenge: challenge.length > 0 ? challenge : null,
      codeChallengeMethod: method,
      accessType:
        params.get('access_type') === 'offline' ? 'offline' : 'online',
      prompts: parsePrompts(params.get('prompt') ?? ''),
      loginHint: params.get('login_hint'),
      createdAtMs: state.clock.now(),
      chosenSub: null,
    },
  };
}

/** `?error=…&state=…` back to the app, exactly as Google bounces it. */
export function authorizeErrorRedirect(args: {
  readonly redirectUri: string;
  readonly state: string | null;
  readonly error: string;
  readonly detail: string;
}): string {
  const url = new URL(args.redirectUri);
  url.searchParams.set('error', args.error);
  if (args.detail.length > 0) {
    url.searchParams.set('error_description', args.detail);
  }
  if (args.state !== null) url.searchParams.set('state', args.state);
  return url.toString();
}
