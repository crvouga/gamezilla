/**
 * Re-run `/identity/refresh` for the current session so the mirrored
 * sign-in methods catch up with a change made at the IdP (an unlink keeps
 * the bearer, so the auth bridge would not notice on its own).
 */

import { refreshAuth } from '@libs/auth-shared/refresh-auth-fetch';
import { useHttpClient } from '@pkgs/http-client-client/solid';
import { useAuthClientPort } from './auth-client-provider';
import { collectDeviceSnapshot } from './collect-device-snapshot';
import { useConfigService } from './config-service-context';
import { useDeviceId } from './use-device-id';

export function useIdentityRefresh(): () => Promise<void> {
  const port = useAuthClientPort();
  const apiUrl = useConfigService().getApiUrl();
  const deviceId = useDeviceId();
  const http = useHttpClient();
  return async () => {
    const token = await port.getFreshToken();
    const device = deviceId();
    if (token === null || device.length === 0) return;
    await refreshAuth({
      apiUrl,
      bearerToken: token,
      deviceId: device,
      fetchFn: http.fetch,
      deviceSnapshot: collectDeviceSnapshot(),
    });
  };
}
