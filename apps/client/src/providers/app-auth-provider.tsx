import { AccountSwitchProvider } from '@libs/auth/client/account-switch/account-switch-provider';
import { AuthBridge } from '@libs/auth/client/auth-bridge';
import { AuthClientProvider } from '@libs/auth/client/auth-client-provider';
import { LocalAccountRosterProvider } from '@libs/auth/client/use-local-account-roster';
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

const authProviders = [
  ClerkAuthStack,
  AppApiClient,
  LocalAccountRosterProvider,
  AccountSwitchProvider,
  AuthBridge,
];

/**
 * Auth session, API client, account-switch controller (above SyncEngineBoot),
 * and auth bridge. Account-switch chrome mounts under {@link AppUiProvider}
 * (needs SurfaceStack / AppUiPortals). Other auth modals mount there too.
 */
export function AppAuthProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <ComposeProviders providers={authProviders}>{children}</ComposeProviders>
  );
}
