import { AuthBridge } from '@libs/auth/client/auth-bridge';
import { AuthClientProvider } from '@libs/auth/client/auth-client-provider';
import { assert } from '@pkgs/assert';
import { createBetterAuthClientAdapter } from '@pkgs/auth-better-auth/client';
import { useIo } from '@pkgs/io';
import { ComposeProviders } from '@pkgs/ui';
import { type ReactNode, useMemo } from 'react';
import { AppApiClient } from './auth/api-client';
import { useClientSystemResources } from './client-system-resources';

function readAuthBaseURL(): string {
  const url = process.env['EXPO_PUBLIC_API_URL']?.trim().replace(/\/$/, '');
  assert.nonEmptyString(
    url,
    'EXPO_PUBLIC_API_URL is required — run apps/client setup'
  );
  return url;
}

function BetterAuthStack({ children }: { children: ReactNode }): ReactNode {
  const { authBaseURL, authClientStorage } = useClientSystemResources();
  const baseURL = useMemo(
    () => authBaseURL ?? readAuthBaseURL(),
    [authBaseURL]
  );
  const io = useIo();
  // Wire the injected transport as Better Auth's fetch so sims running with
  // `createSimIo({ http: honoClient })` dispatch auth in-process (no sockets).
  const port = useMemo(
    () =>
      createBetterAuthClientAdapter({
        baseURL,
        timers: io.timers,
        // Arrow keeps the injected HttpClient receiver (do not pass
        // `io.http.fetch` unbound — Better Auth stores it as customFetchImpl).
        fetch: (input, init) => io.http.fetch(input, init),
        ...(authClientStorage !== undefined
          ? { storage: authClientStorage }
          : {}),
      }),
    [baseURL, io.timers, io.http, authClientStorage]
  );
  return <AuthClientProvider port={port}>{children}</AuthClientProvider>;
}

const authProviders = [BetterAuthStack, AppApiClient, AuthBridge];

/**
 * Auth session, API client, and auth bridge. Auth modals mount under
 * {@link AppUiProvider} (needs SurfaceStack / AppUiPortals).
 *
 * Better Auth `baseURL` defaults to `EXPO_PUBLIC_API_URL`; sims override it
 * via {@link ClientSystemResources}`.authBaseURL` and dispatch through `io.http.fetch`.
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
