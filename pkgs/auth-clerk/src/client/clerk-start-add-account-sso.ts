import type { useClerk } from '@clerk/expo';

import {
  runClerkSsoBrowserFlow,
  type ClerkSsoSignInHandle,
  type ClerkSsoSignUpHandle,
} from './clerk-run-sso-browser-flow';
import type { SsoFlowResult } from './clerk-sso-finalize';

type ClerkInstance = ReturnType<typeof useClerk>;

export async function startClerkAddAccountSsoFlow(args: {
  readonly clerk: ClerkInstance;
  readonly strategy: string;
  readonly redirectUrl: string;
}): Promise<SsoFlowResult> {
  const { clerk, redirectUrl } = args;
  const signIn = clerk.client.signIn;
  const signUp = clerk.client.signUp;
  if (signIn === null || signUp === null) {
    return { createdSessionId: null };
  }
  return runClerkSsoBrowserFlow({
    strategy: 'oauth_google',
    redirectUrl,
    oidcPrompt: 'select_account',
    signIn: signIn as unknown as ClerkSsoSignInHandle,
    signUp: signUp as unknown as ClerkSsoSignUpHandle,
    setActive: async (activeParams) => {
      await clerk.setActive(activeParams);
    },
  });
}
