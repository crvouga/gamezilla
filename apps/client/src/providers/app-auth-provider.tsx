import { useClientEnv } from '@apps/client/product/client-env-provider';
import { AuthClientProvider } from '@libs/auth/public/auth-client-provider';
import { AuthBridge } from '@libs/auth/root/client/auth-bridge';
import { createAuthClientAdapter } from '@pkgs/auth/client';
import { ComposeProviders } from '@pkgs/ui';
import * as WebBrowser from 'expo-web-browser';
import { type ReactNode, useMemo } from 'react';
import { AppApiClient } from './auth/api-client';

function AuthStack({ children }: { children: ReactNode }): ReactNode {
  const env = useClientEnv();
  const port = useMemo(
    () =>
      createAuthClientAdapter({
        baseURL: env.authBaseURL,
        timers: env.timers,
        fetch: (input, init) => env.server(input, init),
        storage: env.authStorage,
        openAuthSession: async (authorizationUrl, callbackUrl) => {
          const result = await WebBrowser.openAuthSessionAsync(
            authorizationUrl,
            callbackUrl
          );
          if (result.type === 'success') {
            return { type: 'success', url: result.url };
          }
          if (result.type === 'cancel') {
            return { type: 'cancel' };
          }
          if (result.type === 'dismiss') {
            return { type: 'dismiss' };
          }
          return { type: 'locked' };
        },
        callbackUrl: 'gamezilla://sso-callback',
      }),
    [env]
  );
  return <AuthClientProvider port={port}>{children}</AuthClientProvider>;
}

const authProviders = [AuthStack, AppApiClient, AuthBridge];

export function AppAuthProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <ComposeProviders providers={authProviders}>{children}</ComposeProviders>
  );
}
