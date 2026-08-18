import { useMyDeviceId } from '../../public/use-current-user';

/** Whether `deviceId` is the current install device. */
export function useDeviceIsCurrent(deviceId: string): boolean {
  return useMyDeviceId() === deviceId;
}
