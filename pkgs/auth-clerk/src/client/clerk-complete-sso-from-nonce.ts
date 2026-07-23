import type {
  ClerkSsoSignInHandle,
  ClerkSsoSignUpHandle,
} from './clerk-sso-handles';
import type { SsoFlowResult } from './clerk-sso-finalize';

export type CompleteClerkSsoFromNonceParams = {
  readonly rotatingTokenNonce: string;
  readonly signIn: ClerkSsoSignInHandle;
  readonly signUp: ClerkSsoSignUpHandle;
  readonly setActive: NonNullable<SsoFlowResult['setActive']>;
};

/**
 * Finishes an OAuth SSO after the provider redirects back with
 * `rotating_token_nonce` (same-tab web redirect, or AuthSession success URL).
 */
export async function completeClerkSsoFromNonce(
  params: CompleteClerkSsoFromNonceParams
): Promise<SsoFlowResult> {
  const { rotatingTokenNonce, signIn, signUp, setActive } = params;

  await signIn.reload({ rotatingTokenNonce });

  if (signIn.firstFactorVerification.status === 'transferable') {
    await signUp.create({ transfer: true });
  }

  return {
    createdSessionId:
      signUp.createdSessionId ?? signIn.createdSessionId ?? null,
    setActive,
    signIn,
    signUp,
  };
}

/** Reads `rotating_token_nonce` from the current browser URL, if present. */
export function readRotatingTokenNonceFromLocation(
  href: string = typeof window !== 'undefined' ? window.location.href : ''
): string | null {
  if (href.length === 0) return null;
  try {
    const nonce = new URL(href).searchParams.get('rotating_token_nonce');
    if (nonce === null || nonce.length === 0) return null;
    return nonce;
  } catch {
    return null;
  }
}
