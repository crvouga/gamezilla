import type { ClientRequestAuth } from '@libs/auth-shared/client-request-auth';
import { useCurrentAccountId } from './use-current-account-id';
import { useDeviceId } from './use-device-id';
import { useFreshAuthToken } from './use-fresh-auth-token';

/** Builds a request-auth snapshot from the live secure-storage hooks. */
export function useClientRequestAuth(): ClientRequestAuth {
  const sessionToken = useFreshAuthToken();
  const deviceId = useDeviceId();
  const accountId = useCurrentAccountId();
  return {
    get sessionToken() {
      return sessionToken();
    },
    get deviceId() {
      return deviceId();
    },
    get accountId() {
      return accountId();
    },
  };
}
