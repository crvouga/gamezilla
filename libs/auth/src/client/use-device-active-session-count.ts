import { useAuthClientPort } from './auth-client-provider';
import { isAuthSessionSignedIn } from './session-snapshot';
import { useMyDeviceId } from './use-current-user';

/**
 * Count of currently-active sessions for the given device. Session state is
 * owned by the auth provider and only the current install can be observed
 * from the client session port.
 */
export function useDeviceActiveSessionCount(deviceId: string): number {
  const currentDeviceId = useMyDeviceId();
  const port = useAuthClientPort();
  const authState = port.useAuthSession();
  if (deviceId !== currentDeviceId) return 0;
  return isAuthSessionSignedIn(authState) ? 1 : 0;
}
