import { AuthBridge } from '@libs/auth/client/auth-bridge';
import { AuthClientProvider } from '@libs/auth/client/auth-client-provider';
import { assert } from '@pkgs/assert';
import {
  ClerkAuthProvider,
  createClerkAuthClientAdapter,
} from '@pkgs/auth-clerk/client';
import { ComposeProviders } from '@pkgs/ui';
import { useMemo, type ReactNode } from 'react';

import { AppApiClient } from './auth/api-client';

function readAuthPublishableKey(): string {
  const key = process.env['EXPO_PUBLIC_AUTH_PUBLISHABLE_KEY']?.trim();
  assert.nonEmptyString(
    key,
    'EXPO_PUBLIC_AUTH_PUBLISHABLE_KEY is required — run apps/client setup'
  );
  return key;
}

function ClerkAuthStack({ children }: { children: ReactNode }): ReactNode {
  const publishableKey = useMemo(() => readAuthPublishableKey(), []);
  const port = useMemo(
    () => createClerkAuthClientAdapter({ publishableKey }),
    [publishableKey]
  );
  return (
    <ClerkAuthProvider config={{ publishableKey }}>
      <AuthClientProvider port={port}>{children}</AuthClientProvider>
    </ClerkAuthProvider>
  );
}

const authProviders = [ClerkAuthStack, AppApiClient, AuthBridge];

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
