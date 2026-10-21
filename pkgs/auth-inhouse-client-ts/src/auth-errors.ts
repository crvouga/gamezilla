/**
 * What a sign-in's answer can mean, as errors the UI can switch on.
 *
 * An OAuth return's callback URL carries exactly one of `?code=`, `?error=`
 * or `?link_required=`, and a refused email link answers with the same keys;
 * {@link readOutcomeParams} turns them into data, and the adapter throws
 * these for everything that is not a code.
 */

import { AUTH_CALLBACK_PARAM } from '@pkgs/auth-inhouse-shared-ts/auth-constants';
import { AuthFlowError } from '@pkgs/auth-root-client-ts/auth-flow-error';
import { AuthLinkRequiredError } from '@pkgs/auth-root-client-ts/auth-link-required-error';
import { isAuthErrorCode } from '@pkgs/auth-root-shared-ts/auth-error-code';
import type { SignInMethodId } from '@pkgs/auth-root-shared-ts/sign-in-method';
import { isSignInMethodId } from '@pkgs/auth-root-shared-ts/sign-in-method';

export type CallbackOutcome =
  | { readonly kind: 'code'; readonly code: string }
  | { readonly kind: 'error'; readonly error: AuthFlowError }
  | { readonly kind: 'link_required'; readonly error: AuthLinkRequiredError }
  | { readonly kind: 'none' };

function providers(raw: string | null): SignInMethodId[] {
  return (raw ?? '').split(',').filter(isSignInMethodId);
}

export function readCallbackOutcome(url: string): CallbackOutcome {
  try {
    return readOutcomeParams(new URL(url).searchParams);
  } catch {
    return { kind: 'none' };
  }
}

export function readOutcomeParams(params: URLSearchParams): CallbackOutcome {
  const code = params.get(AUTH_CALLBACK_PARAM.code) ?? '';
  if (code.length > 0) return { kind: 'code', code };
  const token = params.get(AUTH_CALLBACK_PARAM.linkRequired) ?? '';
  const provider = params.get(AUTH_CALLBACK_PARAM.linkProvider) ?? '';
  if (token.length > 0 && isSignInMethodId(provider)) {
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
