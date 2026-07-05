import { AuthBridge } from '@libs/auth/client/auth-bridge';
import { AuthClientProvider } from '@libs/auth/client/auth-client-provider';
import { ComposeProviders } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { AppApiClient } from './auth/api-client';

const authProviders = [AuthClientProvider, AppApiClient, AuthBridge];

/** Auth session, API client, and auth bridge. Modals mount under {@link AppUiProvider}. */
export function AppAuthProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <ComposeProviders providers={authProviders}>{children}</ComposeProviders>
  );
}
