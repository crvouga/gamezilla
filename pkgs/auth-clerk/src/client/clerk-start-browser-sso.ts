import type { useClerk } from '@clerk/expo';

import {
  type ClerkSsoSignInHandle,
  type ClerkSsoSignUpHandle,
  runClerkSsoBrowserFlow,
} from './clerk-run-sso-browser-flow';
import type { SsoFlowResult } from './clerk-sso-finalize';

type ClerkInstance = ReturnType<typeof useClerk>;

export type StartClerkBrowserSsoFlowArgs = {
  readonly clerk: ClerkInstance;
  readonly redirectUrl: string;
  /** Forces Google/OIDC account picker when set to `select_account`. */
  readonly oidcPrompt?: string;
};

/**
 * Starts Google OAuth via shared browser SSO (same-tab redirect on web,
 * AuthSession on native).
 */
export async function startClerkBrowserSsoFlow(
  args: StartClerkBrowserSsoFlowArgs
): Promise<SsoFlowResult> {
  const { clerk, redirectUrl, oidcPrompt } = args;
  const signIn = clerk.client.signIn;
  const signUp = clerk.client.signUp;
  if (signIn === null || signUp === null) {
    return { createdSessionId: null };
  }
  return runClerkSsoBrowserFlow({
    strategy: 'oauth_google',
    redirectUrl,
    ...(oidcPrompt !== undefined ? { oidcPrompt } : {}),
    signIn: signIn as unknown as ClerkSsoSignInHandle,
    signUp: signUp as unknown as ClerkSsoSignUpHandle,
    setActive: async (activeParams) => {
      await clerk.setActive(activeParams);
    },
  });
}
