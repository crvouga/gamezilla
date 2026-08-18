import { useSignInModal } from '@libs/auth/public/auth-modals-provider';
import { useConfigService } from '@libs/auth/public/config-service-context';
import { useIsSignedIn, useMyId } from '@libs/auth/public/use-current-user';
import { useDeviceId } from '@libs/auth/public/use-device-id';
import {
  type GetFreshAuthTokenFn,
  useFreshAuthToken,
  useGetFreshAuthToken,
} from '@libs/auth/public/use-fresh-auth-token';
import { createFriendsNotificationProvider } from '@libs/friends/root/client/friends-notification-provider';
import { useFriendsClientDeps } from '@libs/friends/root/client/use-friends-client-deps';
import {
  type NotificationProvider,
  type NotificationsClientDeps,
  NotificationsProviderRegistry,
} from '@libs/notifications/public';
import { useHttpClient } from '@pkgs/http-client';
import { type ReactNode, useMemo, useRef } from 'react';

/** Must match {@link ANON_ID_HEADER} in libs/auth session-middleware. */
const X_ANON_ID = 'x-anon-id';

async function resolveNotificationsBearer(
  getFreshToken: GetFreshAuthTokenFn,
  sessionToken: string | null,
  options?: { readonly skipCache?: boolean }
): Promise<string | null> {
  const fresh = await getFreshToken(options);
  if (fresh !== null && fresh.length > 0) return fresh;
  return sessionToken;
}

function applyNotificationsAuthHeaders(
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

function useNotificationsClientDeps(): NotificationsClientDeps {
  const config = useConfigService();
  const apiBaseUrl = config.getApiUrl();
  const { fetch: httpFetch } = useHttpClient();
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
        let token = await resolveNotificationsBearer(
          getFreshToken,
          sessionTokenRef.current
        );
        applyNotificationsAuthHeaders(headers, token, deviceIdRef.current);
        let response = await httpFetch(path, { ...init, headers });
        if (response.status === 401) {
          token = await resolveNotificationsBearer(
            getFreshToken,
            sessionTokenRef.current,
            { skipCache: true }
          );
          const retryHeaders = new Headers(init?.headers);
          applyNotificationsAuthHeaders(
            retryHeaders,
            token,
            deviceIdRef.current
          );
          response = await httpFetch(path, {
            ...init,
            headers: retryHeaders,
          });
        }
        return response;
      },
    }),
    [apiBaseUrl, getFreshToken, httpFetch]
  );
}

export function AppNotificationsProvider({
  children,
}: {
  readonly children: ReactNode;
}): ReactNode {
  const userId = useMyId();
  const isSignedIn = useIsSignedIn();
  const authToken = useFreshAuthToken();
  const deviceId = useDeviceId();
  const isAuthReady = isSignedIn && authToken !== null && deviceId.length > 0;
  const deps = useNotificationsClientDeps();
  const friendsDeps = useFriendsClientDeps();
  const { open: openSignInModal } = useSignInModal();

  const providers = useMemo((): readonly NotificationProvider[] => {
    if (!isSignedIn) return [];
    return [createFriendsNotificationProvider(friendsDeps)];
  }, [friendsDeps, isSignedIn]);

  return (
    <NotificationsProviderRegistry
      userId={userId}
      isSignedIn={isSignedIn}
      isAuthReady={isAuthReady}
      deps={deps}
      providers={providers}
      onSignIn={openSignInModal}
    >
      {children}
    </NotificationsProviderRegistry>
  );
}
