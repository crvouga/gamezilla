import * as WebBrowser from 'expo-web-browser';

import type { SsoFlowResult } from './clerk-sso-finalize';

/** Structural subset of Clerk's SignIn/SignUp resources used by the browser SSO flow. */
export type ClerkSsoSignInHandle = {
  create: (params: {
    strategy: 'oauth_google';
    redirectUrl: string;
    oidcPrompt?: string;
  }) => Promise<unknown>;
  reload: (params: { rotatingTokenNonce: string }) => Promise<unknown>;
  firstFactorVerification: {
    externalVerificationRedirectURL?: { toString(): string } | null;
    status?: string | null;
  };
  createdSessionId?: string | null;
  existingSession?: { sessionId: string } | null;
  status?: string | null;
};

export type ClerkSsoSignUpHandle = {
  create: (params: { transfer: boolean }) => Promise<unknown>;
  createdSessionId?: string | null;
  existingSession?: { sessionId: string } | null;
  status?: string | null;
};

export type RunClerkSsoBrowserFlowParams = {
  readonly strategy: 'oauth_google';
  readonly redirectUrl: string;
  /** Forces Google/OIDC account picker when set to `select_account`. */
  readonly oidcPrompt?: string;
  readonly signIn: ClerkSsoSignInHandle;
  readonly signUp: ClerkSsoSignUpHandle;
  readonly setActive: NonNullable<SsoFlowResult['setActive']>;
};

/**
 * Browser OAuth SSO (mirrors `@clerk/expo` `useSSO`, with optional `oidcPrompt`).
 */
export async function runClerkSsoBrowserFlow(
  params: RunClerkSsoBrowserFlowParams
): Promise<SsoFlowResult> {
  const { strategy, redirectUrl, oidcPrompt, signIn, signUp, setActive } =
    params;

  if (oidcPrompt !== undefined) {
    await signIn.create({ strategy, redirectUrl, oidcPrompt });
  } else {
    await signIn.create({ strategy, redirectUrl });
  }

  const externalUrl = signIn.firstFactorVerification.externalVerificationRedirectURL;
  if (externalUrl === null || externalUrl === undefined) {
    throw new Error('Missing external verification redirect URL for SSO flow');
  }

  const authSessionResult = await WebBrowser.openAuthSessionAsync(
    externalUrl.toString(),
    redirectUrl
  );
  if (authSessionResult.type !== 'success' || !authSessionResult.url) {
    return {
      createdSessionId: null,
      setActive,
      signIn,
      signUp,
    };
  }

  const rotatingTokenNonce =
    new URL(authSessionResult.url).searchParams.get('rotating_token_nonce') ??
    '';
  await signIn.reload({ rotatingTokenNonce });

  if (signIn.firstFactorVerification.status === 'transferable') {
    await signUp.create({ transfer: true });
  }

  return {
    createdSessionId: signUp.createdSessionId ?? signIn.createdSessionId ?? null,
    setActive,
    signIn,
    signUp,
  };
}
