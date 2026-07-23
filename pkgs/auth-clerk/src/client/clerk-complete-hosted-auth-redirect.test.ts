import { describe, expect, mock, test } from 'bun:test';

import { completeClerkSsoFromPersistedAttempt } from './clerk-complete-hosted-auth-redirect';
import type {
  ClerkSsoSignInHandle,
  ClerkSsoSignUpHandle,
} from './clerk-run-sso-browser-flow';

function createSignIn(
  overrides: Partial<ClerkSsoSignInHandle> = {}
): ClerkSsoSignInHandle {
  return {
    create: mock(async () => undefined),
    reload: mock(async () => undefined),
    firstFactorVerification: { status: 'verified' },
    createdSessionId: null,
    ...overrides,
  };
}

function createSignUp(
  overrides: Partial<ClerkSsoSignUpHandle> = {}
): ClerkSsoSignUpHandle {
  return {
    create: mock(async () => undefined),
    createdSessionId: null,
    ...overrides,
  };
}

describe('completeClerkSsoFromPersistedAttempt', () => {
  test('transfers transferable SignIn without a URL nonce', async () => {
    const signIn = createSignIn({
      firstFactorVerification: { status: 'transferable' },
    });
    const signUp = createSignUp({ createdSessionId: 'sess_new' });
    const setActive = mock(async () => undefined);

    const result = await completeClerkSsoFromPersistedAttempt({
      signIn,
      signUp,
      setActive,
    });

    expect(signUp.create).toHaveBeenCalledWith({ transfer: true });
    expect(result.createdSessionId).toBe('sess_new');
  });

  test('returns an already-completed SignIn session id', async () => {
    const signIn = createSignIn({ createdSessionId: 'sess_existing' });
    const signUp = createSignUp();
    const setActive = mock(async () => undefined);

    const result = await completeClerkSsoFromPersistedAttempt({
      signIn,
      signUp,
      setActive,
    });

    expect(signUp.create).not.toHaveBeenCalled();
    expect(result.createdSessionId).toBe('sess_existing');
  });
});
