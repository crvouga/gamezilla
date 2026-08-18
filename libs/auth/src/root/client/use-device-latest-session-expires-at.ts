import { useHydratedSecureStorageItem } from '@pkgs/secure-storage/use-secure-storage-item';

import { SESSION_EXPIRES_AT_KEY } from '../../public/auth-storage-keys';
import {
  useHasAuthSession,
  useMyDeviceId,
} from '../../public/use-current-user';

/**
 * ISO expiry of the auth provider session for the current install, or `null`
 * when the device is not the active signed-in install. Reads secure storage
 * (local-first), not Better Auth `useSession`.
 */
export function useDeviceLatestSessionExpiresAt(
  deviceId: string
): string | null {
  const currentDeviceId = useMyDeviceId();
  const hasSession = useHasAuthSession();
  const { value } = useHydratedSecureStorageItem(SESSION_EXPIRES_AT_KEY);
  if (deviceId !== currentDeviceId || !hasSession) {
    return null;
  }
  if (typeof value === 'string' && value.length > 0) return value;
  return null;
}
