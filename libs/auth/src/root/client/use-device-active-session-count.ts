import { useHasAuthSession, useMyDeviceId } from './use-current-user';

/**
 * Count of currently-active sessions for the given device. Only the current
 * install's local session capability is observable (1 or 0).
 */
export function useDeviceActiveSessionCount(deviceId: string): number {
  const currentDeviceId = useMyDeviceId();
  const hasSession = useHasAuthSession();
  if (deviceId !== currentDeviceId) return 0;
  return hasSession ? 1 : 0;
}
