import { describe, expect, mock, test } from 'bun:test';

import {
  completeClerkSsoFromNonce,
  readRotatingTokenNonceFromLocation,
} from './clerk-complete-sso-from-nonce';
import type {
  ClerkSsoSignInHandle,
  ClerkSsoSignUpHandle,
} from './clerk-run-sso-browser-flow';

function createSignInHandle(
  overrides: Partial<ClerkSsoSignInHandle> = {}
): ClerkSsoSignInHandle {
  return {
    create: mock(async () => undefined),
    reload: mock(async () => undefined),
    firstFactorVerification: { status: 'verified' },
    createdSessionId: 'sess_sign_in',
    ...overrides,
  };
}

function createSignUpHandle(
  overrides: Partial<ClerkSsoSignUpHandle> = {}
): ClerkSsoSignUpHandle {
  return {
    create: mock(async () => undefined),
    createdSessionId: null,
    ...overrides,
  };
}

describe('clerk-complete-sso-from-nonce', () => {
  test('readRotatingTokenNonceFromLocation returns the nonce query param', () => {
    expect(
      readRotatingTokenNonceFromLocation(
        'https://app.example/sso-callback?rotating_token_nonce=abc123'
      )
    ).toBe('abc123');
  });

  test('readRotatingTokenNonceFromLocation returns null when missing', () => {
    expect(
      readRotatingTokenNonceFromLocation('https://app.example/sso-callback')
    ).toBeNull();
  });

  test('completeClerkSsoFromNonce reloads sign-in and returns session id', async () => {
    const signIn = createSignInHandle();
    const signUp = createSignUpHandle();
    const setActive = mock(async () => undefined);

    const result = await completeClerkSsoFromNonce({
      rotatingTokenNonce: 'nonce_1',
      signIn,
      signUp,
      setActive,
    });

    expect(signIn.reload).toHaveBeenCalledWith({
      rotatingTokenNonce: 'nonce_1',
    });
    expect(signUp.create).not.toHaveBeenCalled();
    expect(result.createdSessionId).toBe('sess_sign_in');
  });

  test('completeClerkSsoFromNonce transfers when verification is transferable', async () => {
    const signIn = createSignInHandle({
      createdSessionId: null,
      firstFactorVerification: { status: 'transferable' },
    });
    const signUp = createSignUpHandle({ createdSessionId: 'sess_sign_up' });
    const setActive = mock(async () => undefined);

    const result = await completeClerkSsoFromNonce({
      rotatingTokenNonce: 'nonce_2',
      signIn,
      signUp,
      setActive,
    });

    expect(signUp.create).toHaveBeenCalledWith({ transfer: true });
    expect(result.createdSessionId).toBe('sess_sign_up');
  });
});
