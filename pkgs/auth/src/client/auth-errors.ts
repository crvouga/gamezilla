/**
 * What an OAuth return can mean, as errors the UI can switch on.
 *
 * The callback URL carries exactly one of `?code=`, `?error=` or
 * `?link_required=`; {@link readCallbackOutcome} turns it into data, and the
 * adapter throws these for everything that is not a code.
 */

import {
  AUTH_CALLBACK_PARAM,
  AUTH_ERROR,
  type AuthErrorCode,
  isOauthProviderId,
  type OauthProviderId,
} from '../shared/auth-constants';

import { AuthLinkRequiredError } from './auth-link-required-error';

const ERROR_CODES = new Set<string>(Object.values(AUTH_ERROR));

/** The server refused the sign-in / link for a reason the UI can explain. */
export class AuthFlowError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode) {
    super(`auth: ${code}`);
    this.name = 'AuthFlowError';
    this.code = code;
  }
}

export type CallbackOutcome =
  | { readonly kind: 'code'; readonly code: string }
  | { readonly kind: 'error'; readonly error: AuthFlowError }
  | { readonly kind: 'link_required'; readonly error: AuthLinkRequiredError }
  | { readonly kind: 'none' };

function providers(raw: string | null): OauthProviderId[] {
  return (raw ?? '').split(',').filter(isOauthProviderId);
}

export function readCallbackOutcome(url: string): CallbackOutcome {
  let params: URLSearchParams;
  try {
    params = new URL(url).searchParams;
  } catch {
    return { kind: 'none' };
  }
  const code = params.get(AUTH_CALLBACK_PARAM.code) ?? '';
  if (code.length > 0) return { kind: 'code', code };
  const token = params.get(AUTH_CALLBACK_PARAM.linkRequired) ?? '';
  const provider = params.get(AUTH_CALLBACK_PARAM.linkProvider) ?? '';
  if (token.length > 0 && isOauthProviderId(provider)) {
    return {
      kind: 'link_required',
      error: new AuthLinkRequiredError({
        token,
        email: params.get(AUTH_CALLBACK_PARAM.linkEmail) ?? '',
        providers: providers(params.get(AUTH_CALLBACK_PARAM.linkProviders)),
        provider,
      }),
    };
  }
  const raw = params.get(AUTH_CALLBACK_PARAM.error) ?? '';
  if (ERROR_CODES.has(raw)) {
    return { kind: 'error', error: new AuthFlowError(raw as AuthErrorCode) };
  }
  return { kind: 'none' };
}
