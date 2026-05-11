import { useDeviceService } from './runtime-hooks';

/** Install device id for the current install. */
export function useMyDeviceId(): string {
  return useDeviceService().getDeviceId();
}
