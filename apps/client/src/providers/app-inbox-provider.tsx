import { useConfigService } from '@libs/auth/client/config-service-context';
import { useIsSignedIn, useMyId } from '@libs/auth/client/use-current-user';
import { useSignInModal } from '@libs/auth/client/auth-modals-provider';
import {
  InboxProviderRegistry,
  type InboxClientDeps,
  type InteractionProvider,
} from '@pkgs/inbox/client';
import { createFriendsInteractionProvider } from '@libs/friends/client/friends-interaction-provider';
import { useFriendsClientDeps } from '@libs/friends/client/use-friends-client-deps';
import { useMemo, type ReactNode } from 'react';

function useInboxClientDeps(): InboxClientDeps {
  const config = useConfigService();
  const apiBaseUrl = config.getApiUrl();
  return useMemo(
    () => ({
      apiBaseUrl,
      fetchFn: fetch.bind(globalThis),
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
