import { useMyDeviceId } from '@libs/auth/client/use-current-user';

/** Whether `deviceId` is this install's device seat. */
export function useMemberIsYou(deviceId: string): boolean {
  return useMyDeviceId() === deviceId;
}
