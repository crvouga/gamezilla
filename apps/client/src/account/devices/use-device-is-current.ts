import { useMyDeviceId } from '@gamezilla/client/account/devices/use-my-device-id';

/** Whether `deviceId` is the current install device. */
export function useDeviceIsCurrent(deviceId: string): boolean {
  return useMyDeviceId() === deviceId;
}
