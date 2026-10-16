import type { Driver } from '@pkgs/ui-testing-root-shared/driver';
import { openIsolatedDevice } from './isolated-browser';
import type { Device, LiveTarget } from './live-browser';

export type LiveDevices = {
  host: Device | null;
  guest: Device | null;
  shown: Device | null;
};

export function requireDevice(device: Device | null, who: string): Device {
  if (device === null)
    throw new Error(`no ${who}: a journey opens the app first`);
  return device;
}

/** A second person must never clear the first person's Chrome storage. */
export async function openGuestDevice(
  target: LiveTarget,
  devices: LiveDevices,
  link: string,
  open: typeof openIsolatedDevice = openIsolatedDevice
): Promise<void> {
  devices.guest ??= await open(target);
  const guest = requireDevice(devices.guest, 'guest');
  devices.shown = guest;
  await guest.view.navigate(new URL(link, target.webOrigin).href);
}

/** Activate the person's tab before reading it or delivering native gestures. */
export async function actOnLiveDevice(
  devices: LiveDevices,
  device: Device,
  gestures: (ui: Driver) => Promise<void>
): Promise<void> {
  devices.shown = device;
  await device.view.cdp('Page.bringToFront', {});
  await gestures(device.driver);
}
