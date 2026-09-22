/**
 * How an authorization response travels back to the relying party.
 *
 * Google always answers with a `302` carrying `?code=` (plus its `scope`,
 * `authuser` and `prompt` echo). Apple honours `response_mode`: a query
 * string, a fragment, or — whenever `name` / `email` was requested — an HTML
 * page that POSTs `code`, `state`, optionally `id_token`, and, on the app's
 * first authorization only, a `user` JSON blob with the name and address.
 * The relying party gets that `user` blob exactly once; losing it loses the
 * name for good, which is the Apple behaviour this mock exists to reproduce.
 */

import type { IdpScreenOutcome } from '../../shared/screen-state';
import type { IdpAuthRequest, IdpProviderKind } from '../../shared/types';

export type AuthorizeSuccess = {
  readonly code: string;
  /** `code id_token` only (Apple). */
  readonly idToken: string | null;
  /** Apple's first-authorization `user` JSON, already serialized. */
  readonly user: string | null;
};

type Fields = Record<string, string>;

function deliver(request: IdpAuthRequest, fields: Fields): IdpScreenOutcome {
  if (request.responseMode === 'form_post') {
    return { kind: 'form_post', action: request.redirectUri, fields };
  }
  const url = new URL(request.redirectUri);
  const params = new URLSearchParams(fields);
  if (request.responseMode === 'fragment') {
    url.hash = params.toString();
  } else {
    for (const [key, value] of params) url.searchParams.set(key, value);
  }
  return { kind: 'redirect', location: url.toString() };
}

function withState(request: IdpAuthRequest, fields: Fields): Fields {
  return request.state === null ? fields : { ...fields, state: request.state };
}

export function authorizeSuccessOutcome(
  provider: IdpProviderKind,
  request: IdpAuthRequest,
  success: AuthorizeSuccess
): IdpScreenOutcome {
  if (provider === 'google') {
    return deliver(request, {
      ...withState(request, { code: success.code }),
      scope: request.scopes.join(' '),
      authuser: '0',
      prompt: 'consent',
    });
  }
  const fields: Fields = withState(request, { code: success.code });
  if (success.idToken !== null) fields['id_token'] = success.idToken;
  if (success.user !== null) fields['user'] = success.user;
  return deliver(request, fields);
}

/** The refusal each provider sends when the human cancels. */
export function deniedError(provider: IdpProviderKind): {
  readonly error: string;
  readonly detail: string;
} {
  return provider === 'apple'
    ? { error: 'user_cancelled_authorize', detail: '' }
    : { error: 'access_denied', detail: 'The user denied the request.' };
}

export function authorizeErrorOutcome(
  request: IdpAuthRequest,
  error: { readonly error: string; readonly detail: string }
): IdpScreenOutcome {
  const fields: Fields = { error: error.error };
  if (error.detail.length > 0) fields['error_description'] = error.detail;
  return deliver(request, withState(request, fields));
}
