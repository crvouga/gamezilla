/** @jsxImportSource solid-js */
/**
 * What to tell a person when sign-in, linking or unlinking did not go
 * through, keyed by the server's `AUTH_ERROR` codes.
 *
 * (`.tsx` so the Lingui `msg` macro is compiled by the Solid/Babel pipeline.)
 */

import type { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { AuthFlowError } from '@pkgs/auth-root-client/auth-flow-error';
import type { AuthErrorCode } from '@pkgs/auth-root-shared/auth-error-code';
import type { SignInMethodId } from '@pkgs/auth-root-shared/sign-in-method';

const MESSAGES = {
  cancelled: msg`Sign-in was cancelled or didn't finish.`,
  provider_failed: msg`The sign-in provider couldn't finish. Try again in a moment.`,
  identity_already_linked: msg`That account already signs in to a different account here. Sign in with it to use that account instead.`,
  provider_already_linked: msg`This account already has a sign-in method from that provider. Remove it first to use a different one.`,
  last_identity: msg`This is your only way to sign in, so it can't be removed.`,
  link_mismatch: msg`That isn't the account the address matched, so nothing was connected.`,
  expired: msg`That took too long. Start again.`,
} as const satisfies Record<AuthErrorCode, unknown>;

const PROVIDER_NAMES = {
  google: msg`Google`,
  apple: msg`Apple`,
  email: msg`Email`,
} as const satisfies Record<SignInMethodId, unknown>;

export function providerName(i18n: I18n, provider: SignInMethodId): string {
  return i18n._(PROVIDER_NAMES[provider]);
}

/** A person-readable message for any error an auth flow can throw. */
export function authFlowErrorMessage(i18n: I18n, error: Error): string {
  if (error instanceof AuthFlowError) return i18n._(MESSAGES[error.code]);
  return error.message;
}
