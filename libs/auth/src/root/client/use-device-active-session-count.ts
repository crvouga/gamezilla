import type { Accessor } from 'solid-js';
import { createMemo } from 'solid-js';

import { useHasAuthSession } from '../../public/access-facts';
import { useMyDeviceId } from '../../public/use-current-user';

/**
 * Count of currently-active sessions for the given device. Only the current
 * install's local session capability is observable (1 or 0).
 */
export function useDeviceActiveSessionCount(
  deviceId: Accessor<string>
): Accessor<number> {
  const currentDeviceId = useMyDeviceId();
  const hasSession = useHasAuthSession();
  return createMemo(() => {
    if (deviceId() !== currentDeviceId()) return 0;
    return hasSession() ? 1 : 0;
  });
}
