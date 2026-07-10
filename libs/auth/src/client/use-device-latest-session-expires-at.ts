import { useAuthClientPort } from './auth-client-provider';
import { useMyDeviceId } from './use-current-user';
import { isAuthSessionSignedIn } from './session-snapshot';

function readSessionExpiresAt(
  raw: Date | string | null | undefined
): string | null {
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw === 'string' && raw.length > 0) return raw;
  return null;
}

/**
 * ISO expiry of the auth provider session for the current install, or `null`
 * when the device is not the active signed-in install.
 */
export function useDeviceLatestSessionExpiresAt(
  deviceId: string
): string | null {
  const currentDeviceId = useMyDeviceId();
  const port = useAuthClientPort();
  const authState = port.useAuthSession();
  if (deviceId !== currentDeviceId || !isAuthSessionSignedIn(authState)) {
    return null;
  }
  return readSessionExpiresAt(authState.session?.expiresAt ?? null);
}
