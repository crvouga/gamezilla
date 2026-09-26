/**
 * What an OAuth return can mean, as errors the UI can switch on.
 *
 * The callback URL carries exactly one of `?code=`, `?error=` or
 * `?link_required=`; {@link readCallbackOutcome} turns it into data, and the
 * adapter throws these for everything that is not a code.
 */

import { AuthFlowError, AuthLinkRequiredError } from '@pkgs/auth/client';
import {
  isAuthErrorCode,
  isOauthProviderId,
  type OauthProviderId,
} from '@pkgs/auth/shared';

import { AUTH_CALLBACK_PARAM } from '../shared/auth-constants';

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
  if (isAuthErrorCode(raw)) {
    return { kind: 'error', error: new AuthFlowError(raw) };
  }
  return { kind: 'none' };
}
