import { useClientEnv } from '@apps/client/product/client-env-provider';
import { AuthClientProvider } from '@libs/auth/public/auth-client-provider';
import { AuthBridge } from '@libs/auth/root/client/auth-bridge';
import { createBetterAuthClientAdapter } from '@pkgs/auth-better-auth/client';
import { ComposeProviders } from '@pkgs/ui';
import { type ReactNode, useMemo } from 'react';
import { AppApiClient } from './auth/api-client';

function BetterAuthStack({ children }: { children: ReactNode }): ReactNode {
  const env = useClientEnv();
  const port = useMemo(
    () =>
      createBetterAuthClientAdapter({
        baseURL: env.authBaseURL,
        timers: env.timers,
        fetch: (input, init) => env.server(input, init),
        storage: env.authStorage,
      }),
    [env]
  );
  return <AuthClientProvider port={port}>{children}</AuthClientProvider>;
}

const authProviders = [BetterAuthStack, AppApiClient, AuthBridge];

export function AppAuthProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <ComposeProviders providers={authProviders}>{children}</ComposeProviders>
  );
}
