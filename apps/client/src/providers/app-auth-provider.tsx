import { useClientEnv } from '@apps/client/product/client-env-provider';
import { AuthClientProvider } from '@libs/auth/public/auth-client-provider';
import { AuthBridge } from '@libs/auth/root/client/auth-bridge';
import {
  AUTH_SSO_POPUP_BLOCKED_ERROR,
  createAuthClientAdapter,
  isPopupBlockedError,
} from '@pkgs/auth/client';
import { ComposeProviders } from '@pkgs/ui';
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
        openAuthSession: env.openAuthSession,
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

export { AUTH_SSO_POPUP_BLOCKED_ERROR, isPopupBlockedError };
