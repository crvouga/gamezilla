import type { Accessor } from 'solid-js';
import { createMemo } from 'solid-js';

import { useMyDeviceId } from '../../public/use-current-user';

/** Whether `deviceId` is the current install device. */
export function useDeviceIsCurrent(
  deviceId: Accessor<string>
): Accessor<boolean> {
  const currentDeviceId = useMyDeviceId();
  return createMemo(() => currentDeviceId() === deviceId());
}
