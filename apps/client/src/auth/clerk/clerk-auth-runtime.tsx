import { ClerkProvider, useAuth, useClerk, useSSO } from '@clerk/clerk-expo';
import { useMemo, type ReactNode } from 'react';
import { HostedAuthPortsProvider } from '../hosted-auth-ports-context';
import type { HostedAuthPorts } from '../ports';
import { hostedSsoRedirectUri } from './clerk-sso-redirect';
import { ClerkSessionBridge } from './clerk-session-bridge';
import { clerkSecureTokenCache } from './clerk-token-cache';
import { HostedAuthUiClerkAdapter } from './hosted-auth-ui-clerk-adapter';
import { HostedSessionClerkAdapter } from './hosted-session-clerk-adapter';
import { HostedSignInClerkAdapter } from './hosted-sign-in-clerk-adapter';

function ClerkHostedPortsInner({ children }: { children: ReactNode }) {
  const { startSSOFlow } = useSSO();
  const clerk = useClerk();
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const ports = useMemo<HostedAuthPorts>(() => {
    const startHostedSso = async () => {
      /* eslint-disable lingui/no-unlocalized-strings -- OAuth strategy id + invariant */
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: hostedSsoRedirectUri(),
      });
      if (
        typeof createdSessionId !== 'string' ||
        createdSessionId.length === 0 ||
        setActive === undefined
      ) {
        throw new Error('Hosted sign-in did not complete');
      }
      /* eslint-enable lingui/no-unlocalized-strings */
      await setActive({ session: createdSessionId });
    };

    return {
      session: new HostedSessionClerkAdapter({
        getState: () => ({
          isLoaded,
          isSignedIn: isSignedIn === true,
        }),
        getToken: () => getToken(),
      }),
      signIn: new HostedSignInClerkAdapter({
        start: startHostedSso,
        signOut: async () => {
          await clerk.signOut();
        },
      }),
      ui: new HostedAuthUiClerkAdapter(),
    };
  }, [clerk, getToken, isLoaded, isSignedIn, startSSOFlow]);

  return (
    <HostedAuthPortsProvider value={ports}>{children}</HostedAuthPortsProvider>
  );
}

export function ClerkAuthRuntime({
  publishableKey,
  children,
}: {
  publishableKey: string;
  children: ReactNode;
}) {
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      tokenCache={clerkSecureTokenCache}
    >
      <ClerkSessionBridge />
      <ClerkHostedPortsInner>{children}</ClerkHostedPortsInner>
    </ClerkProvider>
  );
}
