import { completeClerkSsoFromNonce } from './clerk-complete-sso-from-nonce';
import type { SsoFlowResult } from './clerk-sso-finalize';
import type {
  ClerkSsoSignInHandle,
  ClerkSsoSignUpHandle,
} from './clerk-sso-handles';
import { isWebAuthEnvironment } from './is-web-auth-environment';

export type {
  ClerkSsoSignInHandle,
  ClerkSsoSignUpHandle,
} from './clerk-sso-handles';

type OpenAuthSession = (
  url: string,
  redirectUrl: string
) => Promise<{ type: string; url?: string }>;

export type RunClerkSsoBrowserFlowParams = {
  readonly strategy: 'oauth_google';
  readonly redirectUrl: string;
  /** Forces Google/OIDC account picker when set to `select_account`. */
  readonly oidcPrompt?: string;
  readonly signIn: ClerkSsoSignInHandle;
  readonly signUp: ClerkSsoSignUpHandle;
  readonly setActive: NonNullable<SsoFlowResult['setActive']>;
  /** Test seam — defaults to `isWebAuthEnvironment()`. */
  readonly useSameTabRedirect?: boolean;
  /** Test seam — defaults to `window.location.assign`. */
  readonly assignLocation?: (url: string) => void;
  /** Test seam — defaults to `WebBrowser.openAuthSessionAsync`. */
  readonly openAuthSession?: OpenAuthSession;
};

/**
 * Never settles — used after `location.assign` so callers stay pending until
 * the document unloads. The OAuth callback route finishes the session.
 */
function waitUntilUnload(): Promise<never> {
  return new Promise(() => undefined);
}

async function createSsoSignIn(
  signIn: ClerkSsoSignInHandle,
  strategy: 'oauth_google',
  redirectUrl: string,
  oidcPrompt: string | undefined
): Promise<void> {
  if (oidcPrompt !== undefined) {
    await signIn.create({ strategy, redirectUrl, oidcPrompt });
    return;
  }
  await signIn.create({ strategy, redirectUrl });
}

function readExternalOAuthUrl(signIn: ClerkSsoSignInHandle): string {
  const externalUrl =
    signIn.firstFactorVerification.externalVerificationRedirectURL;
  if (externalUrl === null || externalUrl === undefined) {
    throw new Error('Missing external verification redirect URL for SSO flow');
  }
  return externalUrl.toString();
}

async function defaultOpenAuthSession(
  url: string,
  redirectUrl: string
): Promise<{ type: string; url?: string }> {
  const WebBrowser = await import('expo-web-browser');
  return WebBrowser.openAuthSessionAsync(url, redirectUrl);
}

async function runNativeAuthSession(args: {
  oauthUrl: string;
  redirectUrl: string;
  signIn: ClerkSsoSignInHandle;
  signUp: ClerkSsoSignUpHandle;
  setActive: NonNullable<SsoFlowResult['setActive']>;
  openAuthSession: OpenAuthSession;
}): Promise<SsoFlowResult> {
  const { oauthUrl, redirectUrl, signIn, signUp, setActive, openAuthSession } =
    args;
  const authSessionResult = await openAuthSession(oauthUrl, redirectUrl);
  if (authSessionResult.type !== 'success' || !authSessionResult.url) {
    return { createdSessionId: null, setActive, signIn, signUp };
  }
  const rotatingTokenNonce =
    new URL(authSessionResult.url).searchParams.get('rotating_token_nonce') ??
    '';
  return completeClerkSsoFromNonce({
    rotatingTokenNonce,
    signIn,
    signUp,
    setActive,
  });
}

/**
 * Browser OAuth SSO (mirrors `@clerk/expo` `useSSO`, with optional `oidcPrompt`).
 *
 * Web uses a same-tab redirect (`location.assign`) so embedded browsers that
 * break popup `opener` / `postMessage` handshakes still complete. Native keeps
 * Expo AuthSession.
 */
export async function runClerkSsoBrowserFlow(
  params: RunClerkSsoBrowserFlowParams
): Promise<SsoFlowResult> {
  const { strategy, redirectUrl, oidcPrompt, signIn, signUp, setActive } =
    params;

  await createSsoSignIn(signIn, strategy, redirectUrl, oidcPrompt);
  const oauthUrl = readExternalOAuthUrl(signIn);

  const useSameTab = params.useSameTabRedirect ?? isWebAuthEnvironment();
  if (useSameTab) {
    const assign =
      params.assignLocation ?? ((url: string) => window.location.assign(url));
    assign(oauthUrl);
    return waitUntilUnload();
  }

  return runNativeAuthSession({
    oauthUrl,
    redirectUrl,
    signIn,
    signUp,
    setActive,
    openAuthSession: params.openAuthSession ?? defaultOpenAuthSession,
  });
}
