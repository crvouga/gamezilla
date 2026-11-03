import { SESSION_EXPIRES_AT_KEY } from '@libs/auth-shared-ts/auth-storage-keys';
import { createSecureStorageItem } from '@pkgs/secure-storage-root-client-ts/solid';
import type { Accessor } from 'solid-js';
import { createMemo } from 'solid-js';
import { useHasAuthSession } from './access-facts';
import type { DeviceSessionFacts } from './account-device-view';
import { useMyDeviceId } from './use-current-user';

/**
 * This install's device id and its local session (secure storage, not the
 * IdP's `useSession`): all a device screen can know about any session.
 */
export function useDeviceSessionFacts(): Accessor<DeviceSessionFacts> {
  const currentDeviceId = useMyDeviceId();
  const hasSession = useHasAuthSession();
  const expiresItem = createSecureStorageItem(SESSION_EXPIRES_AT_KEY);
  return createMemo(() => {
    const value = expiresItem.value();
    return {
      currentDeviceId: currentDeviceId(),
      hasSession: hasSession(),
      sessionExpiresAt:
        typeof value === 'string' && value.length > 0 ? value : null,
    };
  });
}
