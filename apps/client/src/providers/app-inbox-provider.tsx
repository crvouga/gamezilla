import { useConfigService } from '@libs/auth/client/config-service-context';
import { useIsSignedIn, useMyId } from '@libs/auth/client/use-current-user';
import { useSignInModal } from '@libs/auth/client/auth-modals-provider';
import {
  getCachedDeviceId,
  useDeviceId,
} from '@libs/auth/client/use-device-id';
import {
  getCachedAuthToken,
  useFreshAuthToken,
  useGetFreshAuthToken,
} from '@libs/auth/client/use-fresh-auth-token';
import {
  InboxProviderRegistry,
  type InboxClientDeps,
  type InteractionProvider,
} from '@pkgs/inbox/client';
import { createFriendsInteractionProvider } from '@libs/friends/client/friends-interaction-provider';
import { useFriendsClientDeps } from '@libs/friends/client/use-friends-client-deps';
import { useMemo, type ReactNode } from 'react';

/** Must match {@link ANON_ID_HEADER} in libs/auth session-middleware. */
const X_ANON_ID = 'x-anon-id';

function useInboxClientDeps(): InboxClientDeps {
  const config = useConfigService();
  const apiBaseUrl = config.getApiUrl();
  const getFreshToken = useGetFreshAuthToken();
  // Ensure the install device id is hydrated for getCachedDeviceId().
  useDeviceId();
  return useMemo(
    () => ({
      apiBaseUrl,
      fetchFn: async (path, init) => {
        const headers = new Headers(init?.headers);
        let token = getCachedAuthToken();
        if (token === null || token.length === 0) {
          token = await getFreshToken();
        }
        if (token !== null && token.length > 0) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        const anon = getCachedDeviceId();
        if (anon !== null && anon.length > 0) {
          headers.set(X_ANON_ID, anon);
        }
        return fetch(path, { ...init, headers });
      },
    }),
    [apiBaseUrl, getFreshToken]
  );
}

export function AppInboxProvider({
  children,
}: {
  readonly children: ReactNode;
}): ReactNode {
  const userId = useMyId();
  const isSignedIn = useIsSignedIn();
  const authToken = useFreshAuthToken();
  // Clerk can report signed-in before the bearer lands in secure storage;
  // hold inbox REST (incl. backfill) until the token is readable.
  const isAuthReady = isSignedIn && authToken !== null;
  const deps = useInboxClientDeps();
  const friendsDeps = useFriendsClientDeps();
  const { open: openSignInModal } = useSignInModal();

  const providers = useMemo((): readonly InteractionProvider[] => {
    if (!isSignedIn) return [];
    return [createFriendsInteractionProvider(friendsDeps)];
  }, [friendsDeps, isSignedIn]);

  return (
    <InboxProviderRegistry
      userId={userId}
      isSignedIn={isSignedIn}
      isAuthReady={isAuthReady}
      deps={deps}
      providers={providers}
      onSignIn={openSignInModal}
    >
      {children}
    </InboxProviderRegistry>
  );
}
