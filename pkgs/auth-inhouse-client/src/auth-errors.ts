/**
 * What an OAuth return can mean, as errors the UI can switch on.
 *
 * The callback URL carries exactly one of `?code=`, `?error=` or
 * `?link_required=`; {@link readCallbackOutcome} turns it into data, and the
 * adapter throws these for everything that is not a code.
 */

import { AUTH_CALLBACK_PARAM } from '@pkgs/auth-inhouse-shared/auth-constants';
import { AuthFlowError } from '@pkgs/auth-root-client/auth-flow-error';
import { AuthLinkRequiredError } from '@pkgs/auth-root-client/auth-link-required-error';
import { isAuthErrorCode } from '@pkgs/auth-root-shared/auth-error-code';
import type { SignInMethodId } from '@pkgs/auth-root-shared/sign-in-method';
import {
  isOauthProviderId,
  isSignInMethodId,
} from '@pkgs/auth-root-shared/sign-in-method';

export type CallbackOutcome =
  | { readonly kind: 'code'; readonly code: string }
  | { readonly kind: 'error'; readonly error: AuthFlowError }
  | { readonly kind: 'link_required'; readonly error: AuthLinkRequiredError }
  | { readonly kind: 'none' };

function providers(raw: string | null): SignInMethodId[] {
  return (raw ?? '').split(',').filter(isSignInMethodId);
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
