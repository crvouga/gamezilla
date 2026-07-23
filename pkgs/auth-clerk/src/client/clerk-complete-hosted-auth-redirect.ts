import type { useClerk } from '@clerk/expo';

import {
  completeClerkSsoFromNonce,
  readRotatingTokenNonceFromLocation,
} from './clerk-complete-sso-from-nonce';
import type { ClerkSetActive } from './clerk-ensure-active-session';
import type {
  ClerkSsoSignInHandle,
  ClerkSsoSignUpHandle,
} from './clerk-run-sso-browser-flow';
import {
  finalizeClerkSsoFlowResult,
  readCompletedSessionId,
  type SsoFlowResult,
} from './clerk-sso-finalize';

type ClerkInstance = ReturnType<typeof useClerk>;

function asSsoHandles(clerk: ClerkInstance): {
  signIn: ClerkSsoSignInHandle;
  signUp: ClerkSsoSignUpHandle;
} | null {
  const signIn = clerk.client.signIn;
  const signUp = clerk.client.signUp;
  if (signIn === null || signUp === null) return null;
  return {
    signIn: signIn as unknown as ClerkSsoSignInHandle,
    signUp: signUp as unknown as ClerkSsoSignUpHandle,
  };
}

/**
 * Same-tab OAuth often returns with SignIn already restored from Clerk cookies
 * (`transferable` / `complete`) and no `rotating_token_nonce` in the URL.
 * Finish transfer + setActive from that persisted attempt.
 */
export async function completeClerkSsoFromPersistedAttempt(args: {
  readonly signIn: ClerkSsoSignInHandle;
  readonly signUp: ClerkSsoSignUpHandle;
  readonly setActive: NonNullable<SsoFlowResult['setActive']>;
}): Promise<SsoFlowResult> {
  const { signIn, signUp, setActive } = args;

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

/**
 * Completes same-tab OAuth return: optional nonce reload, then transfer /
 * setActive from the persisted SignIn. Falls back to ensureActiveSession.
 */
export async function runCompleteHostedAuthRedirect(args: {
  readonly clerk: ClerkInstance;
  readonly setActive: ClerkSetActive;
  readonly ensureActiveSession: () => Promise<void>;
}): Promise<void> {
  const { clerk, setActive, ensureActiveSession } = args;
  const handles = asSsoHandles(clerk);
  if (handles === null) {
    await ensureActiveSession();
    return;
  }

  const { signIn, signUp } = handles;
  const rotatingTokenNonce = readRotatingTokenNonceFromLocation();

  let result: SsoFlowResult;
  if (rotatingTokenNonce !== null) {
    result = await completeClerkSsoFromNonce({
      rotatingTokenNonce,
      signIn,
      signUp,
      setActive,
    });
  } else {
    result = await completeClerkSsoFromPersistedAttempt({
      signIn,
      signUp,
      setActive,
    });
  }

  if (readCompletedSessionId(result) !== null) {
    await finalizeClerkSsoFlowResult(result);
    return;
  }

  await ensureActiveSession();
}
