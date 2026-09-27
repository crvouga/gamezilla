import { createSecureStorageItem } from '@pkgs/secure-storage/solid';
import type { Accessor } from 'solid-js';
import { createMemo } from 'solid-js';
import { useHasAuthSession } from '../../public/access-facts';
import { SESSION_EXPIRES_AT_KEY } from '../../public/auth-storage-keys';
import { useMyDeviceId } from '../../public/use-current-user';

/**
 * ISO expiry of the auth provider session for the current install, or `null`
 * when the device is not the active signed-in install. Reads secure storage
 * (local-first), not IdP `useSession`.
 */
export function useDeviceLatestSessionExpiresAt(
  deviceId: Accessor<string>
): Accessor<string | null> {
  const currentDeviceId = useMyDeviceId();
  const hasSession = useHasAuthSession();
  const expiresItem = createSecureStorageItem(SESSION_EXPIRES_AT_KEY);
  return createMemo(() => {
    if (deviceId() !== currentDeviceId() || !hasSession()) {
      return null;
    }
    const value = expiresItem.value();
    return typeof value === 'string' && value.length > 0 ? value : null;
  });
}
