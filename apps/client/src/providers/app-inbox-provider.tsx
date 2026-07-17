import { useConfigService } from '@libs/auth/client/config-service-context';
import { useIsSignedIn, useMyId } from '@libs/auth/client/use-current-user';
import { useSignInModal } from '@libs/auth/client/auth-modals-provider';
import { getCachedDeviceId } from '@libs/auth/client/use-device-id';
import { getCachedAuthToken } from '@libs/auth/client/use-fresh-auth-token';
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

function authedInboxFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers);
  const token = getCachedAuthToken();
  if (token !== null && token.length > 0) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const anon = getCachedDeviceId();
  if (anon !== null && anon.length > 0) {
    headers.set(X_ANON_ID, anon);
  }
  return fetch(path, { ...init, headers });
}

function useInboxClientDeps(): InboxClientDeps {
  const config = useConfigService();
  const apiBaseUrl = config.getApiUrl();
  return useMemo(
    () => ({
      apiBaseUrl,
      fetchFn: authedInboxFetch,
    }),
    [apiBaseUrl]
  );
}

export function AppInboxProvider({
  children,
}: {
  readonly children: ReactNode;
}): ReactNode {
  const userId = useMyId();
  const isSignedIn = useIsSignedIn();
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
      deps={deps}
      providers={providers}
      onSignIn={openSignInModal}
    >
      {children}
    </InboxProviderRegistry>
  );
}
