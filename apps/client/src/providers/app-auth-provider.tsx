import { AuthBridge } from '@libs/auth/client/auth-bridge';
import { AuthClientProvider } from '@libs/auth/client/auth-client-provider';
import { assert } from '@pkgs/assert';
import { createBetterAuthClientAdapter } from '@pkgs/auth-better-auth/client';
import { useIo } from '@pkgs/io';
import { ComposeProviders } from '@pkgs/ui';
import { type ReactNode, useMemo } from 'react';

import { AppApiClient } from './auth/api-client';

function readAuthBaseURL(): string {
  const url = process.env['EXPO_PUBLIC_API_URL']?.trim().replace(/\/$/, '');
  assert.nonEmptyString(
    url,
    'EXPO_PUBLIC_API_URL is required — run apps/client setup'
  );
  return url;
}

function BetterAuthStack({ children }: { children: ReactNode }): ReactNode {
  const baseURL = useMemo(() => readAuthBaseURL(), []);
  const io = useIo();
  const port = useMemo(
    () => createBetterAuthClientAdapter({ baseURL, timers: io.timers }),
    [baseURL, io.timers]
  );
  return <AuthClientProvider port={port}>{children}</AuthClientProvider>;
}

const authProviders = [BetterAuthStack, AppApiClient, AuthBridge];

/**
 * Auth session, API client, and auth bridge. Auth modals mount under
 * {@link AppUiProvider} (needs SurfaceStack / AppUiPortals).
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
