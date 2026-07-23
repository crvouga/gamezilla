import { describe, expect, mock, test } from 'bun:test';

import {
  runClerkSsoBrowserFlow,
  type ClerkSsoSignInHandle,
  type ClerkSsoSignUpHandle,
} from './clerk-run-sso-browser-flow';

function createSignIn(externalUrl: string): ClerkSsoSignInHandle {
  return {
    create: mock(async () => undefined),
    reload: mock(async () => undefined),
    firstFactorVerification: {
      externalVerificationRedirectURL: { toString: () => externalUrl },
      status: 'verified',
    },
    createdSessionId: 'sess_1',
  };
}

function createSignUp(): ClerkSsoSignUpHandle {
  return {
    create: mock(async () => undefined),
    createdSessionId: null,
  };
}

describe('runClerkSsoBrowserFlow', () => {
  test('same-tab redirect assigns the OAuth URL and does not open AuthSession', async () => {
    const assign = mock(() => undefined);
    const openAuthSession = mock(async () => ({ type: 'success' as const }));
    const signIn = createSignIn('https://accounts.google.com/o/oauth2');
    const signUp = createSignUp();
    const setActive = mock(async () => undefined);

    const pending = runClerkSsoBrowserFlow({
      strategy: 'oauth_google',
      redirectUrl: 'https://app.example/sso-callback',
      signIn,
      signUp,
      setActive,
      useSameTabRedirect: true,
      assignLocation: assign,
      openAuthSession,
    });

    await Promise.race([
      pending,
      new Promise((resolve) => setTimeout(resolve, 20)),
    ]);

    expect(assign).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2');
    expect(openAuthSession).not.toHaveBeenCalled();
    expect(signIn.create).toHaveBeenCalledWith({
      strategy: 'oauth_google',
      redirectUrl: 'https://app.example/sso-callback',
    });
  });

  test('AuthSession path completes from the success URL', async () => {
    const openAuthSession = mock(async () => ({
      type: 'success' as const,
      url: 'https://app.example/sso-callback?rotating_token_nonce=from_popup',
    }));
    const signIn = createSignIn('https://accounts.google.com/o/oauth2');
    const signUp = createSignUp();
    const setActive = mock(async () => undefined);

    const result = await runClerkSsoBrowserFlow({
      strategy: 'oauth_google',
      redirectUrl: 'https://app.example/sso-callback',
      signIn,
      signUp,
      setActive,
      useSameTabRedirect: false,
      openAuthSession,
    });

    expect(openAuthSession).toHaveBeenCalledWith(
      'https://accounts.google.com/o/oauth2',
      'https://app.example/sso-callback'
    );
    expect(signIn.reload).toHaveBeenCalledWith({
      rotatingTokenNonce: 'from_popup',
    });
    expect(result.createdSessionId).toBe('sess_1');
  });

  test('AuthSession cancel returns a null session id', async () => {
    const openAuthSession = mock(async () => ({ type: 'dismiss' as const }));
    const signIn = createSignIn('https://accounts.google.com/o/oauth2');
    const signUp = createSignUp();
    const setActive = mock(async () => undefined);

    const result = await runClerkSsoBrowserFlow({
      strategy: 'oauth_google',
      redirectUrl: 'https://app.example/sso-callback',
      signIn,
      signUp,
      setActive,
      useSameTabRedirect: false,
      openAuthSession,
    });

    expect(result.createdSessionId).toBeNull();
    expect(signIn.reload).not.toHaveBeenCalled();
  });
});
