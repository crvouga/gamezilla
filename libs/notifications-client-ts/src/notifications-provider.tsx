/** @jsxImportSource solid-js */
import { useConfigService } from '@libs/auth-client-ts/config-service-context';
import { useMyId } from '@libs/auth-client-ts/use-current-user';
import { useDeviceId } from '@libs/auth-client-ts/use-device-id';
import type { GetFreshAuthTokenFn } from '@libs/auth-client-ts/use-fresh-auth-token';
import {
  useFreshAuthToken,
  useGetFreshAuthToken,
} from '@libs/auth-client-ts/use-fresh-auth-token';
import type { NotificationsClientDeps } from '@libs/notifications-shared-ts/notifications-actions';
import { useCan } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useHttpClient } from '@pkgs/http-client-client-ts/solid';
import { createMemo, type JSX } from 'solid-js';
import { useNotificationSources } from './notification-sources';
import { NotificationsProviderRegistry } from './notifications-provider-registry';
import { NotificationsUnreadCountLiveBridge } from './notifications-unread-count-live-bridge';

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
  const deviceIdRef = () => deviceId();
  const sessionTokenRef = () => sessionToken();
  const deps: NotificationsClientDeps = {
    apiBaseUrl,
    fetchFn: async (path: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      let token = await resolveNotificationsBearer(
        getFreshToken,
        sessionTokenRef()
      );
      applyNotificationsAuthHeaders(headers, token, deviceIdRef());
      let response = await httpFetch(path, { ...init, headers });
      if (response.status === 401) {
        token = await resolveNotificationsBearer(
          getFreshToken,
          sessionTokenRef(),
          { skipCache: true }
        );
        const retryHeaders = new Headers(init?.headers);
        applyNotificationsAuthHeaders(retryHeaders, token, deviceIdRef());
        response = await httpFetch(path, {
          ...init,
          headers: retryHeaders,
        });
      }
      return response;
    },
  };
  return deps;
}

export function AppNotificationsProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const userId = useMyId();
  const canReceive = useCan(PERMISSION.notificationsReceive);
  const authToken = useFreshAuthToken();
  const deviceId = useDeviceId();
  const isAuthReady = createMemo(
    () => canReceive() && authToken() !== null && deviceId().length > 0
  );
  const deps = useNotificationsClientDeps();
  const sources = useNotificationSources();

  // Nothing arrives for someone who may not receive notifications, whatever
  // subs registered.
  const providers = createMemo(() => (canReceive() ? sources() : []));

  return (
    <NotificationsProviderRegistry
      userId={userId()}
      isAuthReady={isAuthReady()}
      deps={deps}
      providers={providers()}
    >
      <NotificationsUnreadCountLiveBridge>
        {props.children}
      </NotificationsUnreadCountLiveBridge>
    </NotificationsProviderRegistry>
  );
}
