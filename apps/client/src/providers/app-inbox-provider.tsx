import { useConfigService } from '@libs/auth/client/config-service-context';
import { useIsSignedIn, useMyId } from '@libs/auth/client/use-current-user';
import { useSignInModal } from '@libs/auth/client/auth-modals-provider';
import { useDeviceId } from '@libs/auth/client/use-device-id';
import {
  useFreshAuthToken,
  useGetFreshAuthToken,
  type GetFreshAuthTokenFn,
} from '@libs/auth/client/use-fresh-auth-token';
import {
  InboxProviderRegistry,
  type InboxClientDeps,
  type InteractionProvider,
} from '@pkgs/inbox/client';
import { createFriendsInteractionProvider } from '@libs/friends/client/friends-interaction-provider';
import { useFriendsClientDeps } from '@libs/friends/client/use-friends-client-deps';
import { useMemo, useRef, type ReactNode } from 'react';

/** Must match {@link ANON_ID_HEADER} in libs/auth session-middleware. */
const X_ANON_ID = 'x-anon-id';

async function resolveInboxBearer(
  getFreshToken: GetFreshAuthTokenFn,
  sessionToken: string | null,
  options?: { readonly skipCache?: boolean }
): Promise<string | null> {
  const fresh = await getFreshToken(options);
  if (fresh !== null && fresh.length > 0) return fresh;
  return sessionToken;
}

function applyInboxAuthHeaders(
  headers: Headers,
  token: string | null,
  deviceId: string
): void {
  if (token !== null && token.length > 0) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (deviceId.length > 0) {
    headers.set(X_ANON_ID, deviceId);
  }
}

function useInboxClientDeps(): InboxClientDeps {
  const config = useConfigService();
  const apiBaseUrl = config.getApiUrl();
  const getFreshToken = useGetFreshAuthToken();
  const deviceId = useDeviceId();
  const sessionToken = useFreshAuthToken();
  const deviceIdRef = useRef(deviceId);
  const sessionTokenRef = useRef(sessionToken);
  deviceIdRef.current = deviceId;
  sessionTokenRef.current = sessionToken;
  return useMemo(
    () => ({
      apiBaseUrl,
      fetchFn: async (path, init) => {
        const headers = new Headers(init?.headers);
        let token = await resolveInboxBearer(
          getFreshToken,
          sessionTokenRef.current
        );
        applyInboxAuthHeaders(headers, token, deviceIdRef.current);
        let response = await fetch(path, { ...init, headers });
        // Stale bearer after idle — force-mint and retry once.
        if (response.status === 401) {
          token = await resolveInboxBearer(
            getFreshToken,
            sessionTokenRef.current,
            { skipCache: true }
          );
          const retryHeaders = new Headers(init?.headers);
          applyInboxAuthHeaders(retryHeaders, token, deviceIdRef.current);
          response = await fetch(path, { ...init, headers: retryHeaders });
        }
        return response;
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
  const deviceId = useDeviceId();
  // Account id + bearer can hydrate before session mint / device settle;
  // hold inbox REST (incl. backfill) until both are readable.
  const isAuthReady = isSignedIn && authToken !== null && deviceId.length > 0;
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
