import { useDeviceService } from './device-service-context';

/** Install device id for the current install. */
export function useMyDeviceId(): string {
  return useDeviceService().getDeviceId();
}
